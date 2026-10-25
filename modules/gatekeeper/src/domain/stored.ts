// A gate as server mode stores it, and as the HTTP API shows it (ADR 0048).
import type { GateView } from "@opensoftware/contracts";
import type { Gate } from "./gate.ts";
import type { Groups, Rules } from "./policy.ts";
import type { GateRecord } from "./record.ts";
import type { GateRequest } from "./request.ts";
import { toIso } from "./time.ts";

export interface StoredGate {
  id: string;
  request: GateRequest;
  /** The policy's answer when the gate was requested: a later change of the policy leaves an open gate alone. */
  rules: Rules;
  channel: string;
  /** The channel port's thread of the request, like slack:C0GATES:1767225600.000001, once it is posted. */
  thread: string | null;
  /** Microseconds since 1970. */
  requestedAt: number;
  state: GateView["state"];
  waitingFor: string[];
  record: GateRecord | null;
}

export const gateOf = (stored: StoredGate, groups: Groups, policy: string): Gate => ({
  id: stored.id,
  request: stored.request,
  rules: stored.rules,
  groups,
  policy,
});

export function viewOf(stored: StoredGate): GateView {
  const { rules, request } = stored;
  return {
    id: stored.id,
    workItem: request.workItem,
    stage: request.stage,
    summary: request.summary,
    risk: rules.risk,
    approvers: rules.approvers,
    escalateTo: rules.escalation?.to,
    channel: stored.channel,
    state: stored.state,
    waitingFor: stored.state === "pending" ? stored.waitingFor : undefined,
    requestedAt: toIso(stored.requestedAt),
    expiresAt: rules.expireAfter === undefined ? undefined : toIso(stored.requestedAt + rules.expireAfter),
    record: stored.record ?? undefined,
  };
}
