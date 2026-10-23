// The CloudEvents gatekeeper publishes: gate.requested@v1 and gate.decided@v1. The event ID is the gate's ID with
// ".requested" or ".decided", so a consumer that gets an event twice can drop the copy.
import type { GateDecided, GateRequested } from "@opensoftware/contracts";
import type { Decided, Gate } from "./gate.ts";
import { toIso } from "./time.ts";

export interface Outgoing {
  subject: string;
  event: GateRequested | GateDecided;
}

const envelope = <Type extends string>(type: Type, gate: string, now: number) => ({
  specversion: "1.0" as const,
  id: `${gate}.${type.split(".")[1]?.split("@")[0]}`,
  source: "/osf/gatekeeper",
  type,
  time: toIso(now),
  subject: gate,
  datacontenttype: "application/json" as const,
});

/** A person decides as a person; a policy without approver groups decides as a trigger. */
export const deciderOf = (by: string) => ({ kind: by.startsWith("policy:") ? "trigger" : "person", id: by }) as const;

export function requestedEvent(gate: Gate, requestedAt: number, now: number): Outgoing {
  const { expireAfter } = gate.rules;
  return {
    subject: "osf.gate.requested.v1",
    event: {
      ...envelope("gate.requested@v1", gate.id, now),
      data: {
        gateId: gate.id,
        workItemId: gate.request.workItem,
        stage: gate.request.stage,
        policy: gate.policy,
        approvers: gate.rules.approvers,
        summary: gate.request.summary,
        links: gate.request.links.length ? gate.request.links : undefined,
        expiresAt: expireAfter === undefined ? undefined : toIso(requestedAt + expireAfter),
      },
    },
  };
}

export function decidedEvent(gate: Gate, outcome: Decided, now: number): Outgoing {
  return {
    subject: "osf.gate.decided.v1",
    event: {
      ...envelope("gate.decided@v1", gate.id, now),
      data: {
        gateId: gate.id,
        workItemId: gate.request.workItem,
        decision: outcome.state,
        decidedBy: outcome.state === "expired" ? undefined : deciderOf(outcome.by),
        decidedAt: toIso(outcome.at),
        reason: outcome.state === "rejected" ? outcome.reason : undefined,
      },
    },
  };
}
