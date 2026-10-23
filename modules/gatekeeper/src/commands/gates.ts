// The gates of server mode: request, decide on an event or a press, check the pending gates, and relay the outbox
// to NATS (ADR 0048). The decision is the same domain function as "gatekeeper status".
import { publishAll } from "../adapters/nats.ts";
import { evaluate } from "../adapters/opa.ts";
import type { Store } from "../adapters/postgres.ts";
import { decidedEvent, type Outgoing, requestedEvent } from "../domain/events.ts";
import {
  type Channel,
  type Decided,
  decide,
  decisionButtons,
  type Gate,
  isDecisionButton,
  type Message,
  marker,
  pressMessage,
  requestText,
} from "../domain/gate.ts";
import { parseGroups, parseRules } from "../domain/policy.ts";
import { buildRecord, signWith } from "../domain/record.ts";
import { type GateRequest, gateId } from "../domain/request.ts";
import { gateOf, type StoredGate } from "../domain/stored.ts";
import { fromSlackTs } from "../domain/time.ts";

export interface GatesConfig {
  policy: string;
  policyText: string;
  groupsFile: string;
  /** The groups file as JSON; checked against each policy answer. */
  groups: unknown;
  channel: Channel;
  opa: string;
  signingKey?: string;
  nats?: string;
  now(): number;
  /** Where a failed relay or check is reported. */
  warn(text: string): void;
}

/** A Slack `message` event: a reply in a gate's thread makes the server decide that gate. */
export interface SlackMessageEvent {
  type?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
}

/** A Slack `block_actions` payload. */
export interface SlackActions {
  type?: string;
  user?: { id?: string };
  actions?: { action_id?: string; value?: string; action_ts?: string }[];
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
      const request: Message = { id: stored.thread, author: "", time: stored.requestedAt, text: "", mine: true };
      const presses = (await changes.presses()).map((press) =>
        pressMessage({ actionId: press.action, author: press.author, ts: press.ts, time: fromSlackTs(press.ts) }),
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
        posted = await channel.post(
          requestText(gate, channel),
          marker(id, "requested"),
          undefined,
          decisionButtons(id),
        );
      } catch (error) {
        await store.remove(id);
        throw error;
      }
      const asked = { ...pending, thread: posted.id, requestedAt: posted.time };
      await store.locked(id, async (_, changes) => {
        await changes.update(asked);
        const event = events(requestedEvent(gate, posted.time, now));
        if (event) await changes.emit(event);
      });
      await relay();
      return { created: true, gate: asked };
    },

    get: (id: string) => store.get(id),

    /** A reply in the thread of a gate in this channel. */
    async message(event: SlackMessageEvent): Promise<void> {
      if (event.type !== "message" || `slack:${event.channel}` !== channel.name) return;
      if (!event.thread_ts || event.thread_ts === event.ts) return;
      const stored = await store.byThread(channel.name, event.thread_ts);
      if (stored) await decideGate(stored.id);
    },

    /** A press of Approve or Reject: kept with Slack's action time, then the gate is decided. */
    async actions(payload: SlackActions): Promise<void> {
      if (payload.type !== "block_actions" || !payload.user?.id) return;
      for (const action of payload.actions ?? []) {
        if (!action.action_id || !isDecisionButton(action.action_id) || !action.value || !action.action_ts) continue;
        const stored = await store.get(action.value);
        if (stored?.channel !== channel.name) continue;
        await store.press(stored.id, {
          ts: action.action_ts,
          author: `slack:${payload.user.id}`,
          action: action.action_id,
        });
        await decideGate(stored.id);
      }
    },

    /** Decides every pending gate at the current time: escalation and expiry need no event. */
    async check(): Promise<void> {
      for (const id of await store.pending()) {
        await decideGate(id).catch((error) => config.warn(`cannot check the gate ${id}: ${(error as Error).message}`));
      }
      await relay();
    },

    /** Waits for the relay that runs. */
    idle: () => relaying,
  };
}
