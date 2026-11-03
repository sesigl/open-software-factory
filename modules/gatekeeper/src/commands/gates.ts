// The gates of server mode: request, decide on a press or a message, check the pending gates, and relay the outbox
// to NATS (ADR 0048, ADR 0062). A gate is asked in the Slack channel or, with the forge, on the pull request that the
// request links (ADR 0080). The decision is the same domain function as "gatekeeper status".
import { UsageError } from "@opensoftware/cli";
import type { Forge } from "../adapters/forge.ts";
import { publishAll } from "../adapters/nats.ts";
import { evaluate } from "../adapters/opa.ts";
import type { Store } from "../adapters/postgres.ts";
import { decidedEvent, type Outgoing, requestedEvent } from "../domain/events.ts";
import {
  type Channel,
  DECISION_CHOICES,
  type Decided,
  decide,
  describe,
  type Gate,
  isDecisionChoice,
  type Message,
  marker,
  type Outcome,
  pressMessage,
  requestText,
} from "../domain/gate.ts";
import { parseGroups, parseRules } from "../domain/policy.ts";
import { commitState, type PullLine, type PullRequest, pullRequestIn, pullRequestOf } from "../domain/pull-request.ts";
import { buildRecord, signWith } from "../domain/record.ts";
import { type GateRequest, gateId } from "../domain/request.ts";
import { gateOf, type StoredGate } from "../domain/stored.ts";

export interface GatesConfig {
  policy: string;
  policyText: string;
  groupsFile: string;
  /** The groups file as JSON; checked against each policy answer. */
  groups: unknown;
  /** The Slack channel, unless the server asks only on pull requests. */
  slack?: Channel;
  /** The forge of a pull request, when the server has GATEKEEPER_FORGE_TOKEN (ADR 0080). */
  forge?: (pr: PullRequest) => Forge;
  opa: string;
  signingKey?: string;
  nats?: string;
  now(): number;
  /** Where a failed relay or check is reported. */
  warn(text: string): void;
}

/** Where a gate is asked and decided, and how its outcome is reported there. */
interface Place {
  channel: Channel;
  /** Sets the commit status "gatekeeper" on a pull request; nothing in Slack. */
  report(outcome: Outcome): Promise<void>;
}

/** A person's choice on a card, as the channel port's `receive` prints it. */
export interface Decision {
  thread: string;
  choice: string;
  person: string;
}

export function gates(config: GatesConfig, store: Store) {
  const { slack, forge, policy } = config;
  const gateFor = (request: GateRequest, rules: Gate["rules"]): Gate => ({
    id: gateId(request),
    request,
    rules,
    groups: parseGroups(config.groups, config.groupsFile, rules),
    policy,
  });
  const recordOf = (gate: Gate, channel: string, requestedAt: number, outcome: Decided) =>
    signWith(buildRecord(gate, { policyText: config.policyText, channel, requestedAt }, outcome), config.signingKey);

  /** The pull request of each gate as the server read it when it asked: its head commit gets the commit status. */
  const pulls = new Map<string, PullLine>();
  /** The place of a gate by its channel's name: the Slack channel or a pull request. Undefined for another name. */
  async function placeOf(id: string, name: string): Promise<Place | undefined> {
    if (slack?.name === name) return { channel: slack, report: async () => {} };
    const pr = forge && pullRequestOf(name);
    if (!forge || !pr) return undefined;
    const reached = forge(pr);
    const pull = pulls.get(id) ?? (await reached.read());
    pulls.set(id, pull);
    return {
      channel: reached.channel(pull),
      report: (outcome) => reached.status(pull.sha, commitState(outcome), describe(outcome)),
    };
  }
  const events = (outgoing: Outgoing): Outgoing | undefined => (config.nats ? outgoing : undefined);

  let relaying: Promise<void> = Promise.resolve();
  /** Publishes the unpublished events in order, one relay at a time. They wait when NATS is unreachable. */
  const relay = (): Promise<void> => {
    const nats = config.nats;
    if (!nats) return relaying;
    relaying = relaying
      .then(async () => {
        const waiting = await store.unpublished();
        if (waiting.length === 0) return;
        await publishAll(nats, waiting);
        await store.published(waiting.map((row) => row.seq));
      })
      .catch((error) => config.warn(`the events wait in the outbox: ${(error as Error).message}`));
    return relaying;
  };

  async function decideGate(id: string): Promise<void> {
    await store.locked(id, async (stored, changes) => {
      if (!stored?.thread || stored.state !== "pending") return;
      const place = await placeOf(id, stored.channel);
      if (!place) return;
      const { channel } = place;
      const gate = gateOf(stored, parseGroups(config.groups, config.groupsFile, stored.rules), policy);
      const request: Message = { id: stored.thread, author: "", time: stored.requestedAt, text: "", mine: true };
      // A press counts at the time the server got it, and never before the request.
      const presses = (await changes.presses()).map((press) =>
        pressMessage({
          choice: press.action,
          author: press.author,
          id: press.ts,
          time: Math.max(Number(press.ts), stored.requestedAt),
        }),
      );
      const thread = [...(await channel.thread(request)), ...presses].sort((a, b) => a.time - b.time);
      const now = config.now();
      const { outcome, posts } = decide(gate, stored.requestedAt, thread, now, channel);
      for (const post of posts) await channel.answer(request, post.text, post.marker);
      if (outcome.state === "pending") {
        await changes.update({ ...stored, waitingFor: outcome.waitingFor });
        return;
      }
      const record = recordOf(gate, stored.channel, stored.requestedAt, outcome);
      await changes.update({ ...stored, state: outcome.state, waitingFor: [], record });
      const event = events(decidedEvent(gate, outcome, now));
      if (event) await changes.emit(event);
      await place.report(outcome);
      pulls.delete(id);
    });
    await relay();
  }

  return {
    /** Asks the approver groups once per gate. `created` is false when the same request made the gate before. */
    async request(request: GateRequest): Promise<{ created: boolean; gate: StoredGate }> {
      const id = gateId(request);
      const existing = await store.get(id);
      if (existing) return { created: false, gate: existing };
      const name = (forge && pullRequestIn(request.links)?.url) || slack?.name;
      if (!name)
        throw new UsageError(
          "the request links no pull request, like https://github.com/acme/web/pull/12, and the server has no Slack channel",
        );
      const gate = gateFor(request, parseRules(await evaluate(config.opa, policy, request), policy));
      const now = config.now();
      const base = { id, request, rules: gate.rules, channel: name, thread: null, requestedAt: now };
      if (gate.rules.approvers.length === 0) {
        const outcome = { state: "approved", by: `policy:${policy}`, at: now } as const;
        const record = recordOf(gate, name, now, outcome);
        const approved: StoredGate = { ...base, state: "approved", waitingFor: [], record };
        const created = await store.claim(approved, events(decidedEvent(gate, outcome, now)));
        await relay();
        return { created, gate: created ? approved : ((await store.get(id)) as StoredGate) };
      }
      const pending: StoredGate = { ...base, state: "pending", waitingFor: gate.rules.approvers, record: null };
      if (!(await store.claim(pending))) return { created: false, gate: (await store.get(id)) as StoredGate };
      let asked: StoredGate;
      try {
        const { channel, report } = (await placeOf(id, name)) as Place;
        const posted = await channel.ask(requestText(gate, channel), marker(id, "requested"), DECISION_CHOICES);
        // The status is set before the gate has its thread, so no check decides the gate before it.
        await report({ state: "pending", waitingFor: gate.rules.approvers });
        asked = { ...pending, thread: posted.id, requestedAt: posted.time ?? now };
      } catch (error) {
        pulls.delete(id);
        await store.remove(id);
        throw error;
      }
      await store.locked(id, async (_, changes) => {
        await changes.update(asked);
        const event = events(requestedEvent(gate, asked.requestedAt, now));
        if (event) await changes.emit(event);
      });
      await relay();
      return { created: true, gate: asked };
    },

    get: (id: string) => store.get(id),

    /** A press of Approve or Reject on a gate's card: kept with the server's time, then the gate is decided. */
    async decision(decision: Decision): Promise<void> {
      if (!slack || !isDecisionChoice(decision.choice)) return;
      const stored = await store.byThread(slack.name, decision.thread);
      if (!stored) return;
      await store.press(stored.id, { ts: String(config.now()), author: decision.person, action: decision.choice });
      await decideGate(stored.id);
    },

    /**
     * Decides every pending gate at the current time, or those whose channel `only` accepts: escalation and expiry
     * need no event, and a pull request sends no event at all.
     */
    async check(only: (channel: string) => boolean = () => true): Promise<void> {
      for (const { id, channel } of await store.pending()) {
        if (!only(channel)) continue;
        await decideGate(id).catch((error) => config.warn(`cannot check the gate ${id}: ${(error as Error).message}`));
      }
      await relay();
    },

    /** Waits for the relay that runs. */
    idle: () => relaying,
  };
}
