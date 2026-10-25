// The gates of server mode: request, decide on an event or a press, check the pending gates, and relay the outbox
// to NATS (ADR 0048). The decision is the same domain function as "gatekeeper status".
import { publishAll } from "../adapters/nats.ts";
import { evaluate } from "../adapters/opa.ts";
import type { Store } from "../adapters/postgres.ts";
import { decidedEvent, type Outgoing, requestedEvent } from "../domain/events.ts";
import {
  CHOICES,
  type Channel,
  type Decided,
  decide,
  type Gate,
  type Message,
  marker,
  pressMessage,
  requestText,
} from "../domain/gate.ts";
import { parseGroups, parseRules } from "../domain/policy.ts";
import { buildRecord, signWith } from "../domain/record.ts";
import { type GateRequest, gateId } from "../domain/request.ts";
import { gateOf, type StoredGate } from "../domain/stored.ts";
import { fromIso } from "../domain/time.ts";

export interface GatesConfig {
  policy: string;
  policyText: string;
  groupsFile: string;
  /** The groups file as JSON; checked against each policy answer. */
  groups: unknown;
  channel: Channel & { receive(file: string, follow: string[]): Promise<Record<string, unknown>[]> };
  opa: string;
  signingKey?: string;
  nats?: string;
  now(): number;
  /** Where a failed relay or check is reported. */
  warn(text: string): void;
}

/** What the channel port's receive prints for a delivery: a decision on a card, or a message in a followed thread. */
interface Received {
  kind?: string;
  thread?: string;
  choice?: string;
  person?: string;
  time?: string;
}

export function gates(config: GatesConfig, store: Store) {
  const { channel, policy } = config;
  const gateFor = (request: GateRequest, rules: Gate["rules"]): Gate => ({
    id: gateId(request),
    request,
    rules,
    groups: parseGroups(config.groups, config.groupsFile, rules),
    policy,
  });
  const recordOf = (gate: Gate, requestedAt: number, outcome: Decided) =>
    signWith(
      buildRecord(gate, { policyText: config.policyText, channel: channel.name, requestedAt }, outcome),
      config.signingKey,
    );
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
      const gate = gateOf(stored, parseGroups(config.groups, config.groupsFile, stored.rules), policy);
      const request: Message = {
        id: stored.thread,
        thread: stored.thread,
        author: "",
        time: stored.requestedAt,
        text: "",
        mine: true,
      };
      const presses = (await changes.presses()).map((press) =>
        pressMessage({ choice: press.action, author: press.author, time: fromIso(press.ts) }),
      );
      const thread = [...(await channel.thread(request)), ...presses].sort((a, b) => a.time - b.time);
      const now = config.now();
      const { outcome, posts } = decide(gate, stored.requestedAt, thread, now, channel);
      for (const post of posts) await channel.post(post.text, post.marker, request);
      if (outcome.state === "pending") {
        await changes.update({ ...stored, waitingFor: outcome.waitingFor });
        return;
      }
      const record = recordOf(gate, stored.requestedAt, outcome);
      await changes.update({ ...stored, state: outcome.state, waitingFor: [], record });
      const event = events(decidedEvent(gate, outcome, now));
      if (event) await changes.emit(event);
    });
    await relay();
  }

  return {
    /** Asks the approver groups once per gate. `created` is false when the same request made the gate before. */
    async request(request: GateRequest): Promise<{ created: boolean; gate: StoredGate }> {
      const id = gateId(request);
      const existing = await store.get(id);
      if (existing) return { created: false, gate: existing };
      const gate = gateFor(request, parseRules(await evaluate(config.opa, policy, request), policy));
      const now = config.now();
      const base = { id, request, rules: gate.rules, channel: channel.name, thread: null, requestedAt: now };
      if (gate.rules.approvers.length === 0) {
        const outcome = { state: "approved", by: `policy:${policy}`, at: now } as const;
        const record = recordOf(gate, now, outcome);
        const approved: StoredGate = { ...base, state: "approved", waitingFor: [], record };
        const created = await store.claim(approved, events(decidedEvent(gate, outcome, now)));
        await relay();
        return { created, gate: created ? approved : ((await store.get(id)) as StoredGate) };
      }
      const pending: StoredGate = { ...base, state: "pending", waitingFor: gate.rules.approvers, record: null };
      if (!(await store.claim(pending))) return { created: false, gate: (await store.get(id)) as StoredGate };
      let posted: Message;
      try {
        posted = await channel.post(requestText(gate, channel), marker(id, "requested"), undefined, CHOICES);
      } catch (error) {
        await store.remove(id);
        throw error;
      }
      const asked = { ...pending, thread: posted.thread ?? posted.id, requestedAt: posted.time };
      await store.locked(id, async (_, changes) => {
        await changes.update(asked);
        const event = events(requestedEvent(gate, posted.time, now));
        if (event) await changes.emit(event);
      });
      await relay();
      return { created: true, gate: asked };
    },

    get: (id: string) => store.get(id),

    /**
     * A delivery from Slack, as the channel port's receive reads it with the threads of the pending gates: a reply in
     * a gate's thread decides that gate, and a press is kept with its time first.
     */
    async delivery(file: string): Promise<void> {
      const follow = (await store.pending()).map((gate) => gate.thread);
      for (const line of (await channel.receive(file, follow)) as Received[]) {
        const stored = line.thread ? await store.byThread(channel.name, line.thread) : undefined;
        if (!stored) continue;
        if (line.kind === "decision" && line.choice && line.person && line.time)
          await store.press(stored.id, { ts: line.time, author: line.person, action: line.choice });
        if (line.kind === "decision" || line.kind === "message") await decideGate(stored.id);
      }
    },

    /** Decides every pending gate at the current time: escalation and expiry need no event. */
    async check(): Promise<void> {
      for (const { id } of await store.pending()) {
        await decideGate(id).catch((error) => config.warn(`cannot check the gate ${id}: ${(error as Error).message}`));
      }
      await relay();
    },

    /** Waits for the relay that runs. */
    idle: () => relaying,
  };
}
