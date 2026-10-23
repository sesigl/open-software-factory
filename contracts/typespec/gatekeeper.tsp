import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/** gatekeeper: what a person is asked to approve, and the facts the policy decides on (ADR 0047). */
model GateRequest {
  /** What waits: a work item ID or a URL. */
  @minLength(1)
  @maxLength(128)
  workItem: string;

  /** The stage that waits, for example "merge". */
  stage: Name;

  /** What the approvers decide, shown in the channel. */
  @minLength(1)
  summary: string;

  links?: Link[];

  /** Any facts the policy needs, such as changed paths, labels or the author. */
  change?: Record<unknown>;
}

/** A gate's state: waiting, or how it was decided. */
enum GateState {
  pending,
  approved,
  rejected,
  expired,
}

/** gatekeeper: a gate as the HTTP API shows it (ADR 0048). */
model GateView {
  /** "g" and 16 hex digits of the SHA-256 of the work item, the stage and the change. */
  @pattern("^g[0-9a-f]{16}$")
  id: string;

  workItem: string;
  stage: Name;
  summary: string;

  /** The risk the policy named, for example "high". */
  risk?: string;

  /** The groups whose members may decide. Empty when the policy approved without a person. */
  approvers: Name[];

  /** The groups asked after the escalation time. */
  escalateTo?: Name[];

  /** Where people decide, for example "slack:C0GATES". */
  channel: string;

  state: GateState;

  /** The groups that may decide now. Only while the gate is pending. */
  waitingFor?: Name[];

  requestedAt: utcDateTime;

  /** When the gate expires without a decision. */
  expiresAt?: utcDateTime;

  /** The record, once the gate is decided. */
  record?: GateRecord;
}

/** gatekeeper: who decided what and when, signed with Ed25519 (ADR 0047). */
model GateRecord {
  @pattern("^g[0-9a-f]{16}$")
  gate: string;

  workItem: string;
  stage: Name;
  summary: string;

  /** SHA-256 of the canonical request: what was approved. */
  @pattern("^sha256:[0-9a-f]{64}$")
  request: string;

  /** The policy file. */
  @minLength(1)
  policy: string;

  /** SHA-256 of the policy's text: the rules that picked the approvers. */
  @pattern("^sha256:[0-9a-f]{64}$")
  policyDigest: string;

  risk?: string;
  approvers: Name[];
  channel: string;
  requestedAt: utcDateTime;
  decision: GateDecision;

  /** Who decided. Absent only when the gate expired. A policy that names no group decides as a trigger. */
  decidedBy?: Actor;

  decidedAt: utcDateTime;

  /** The reason of a rejection. */
  reason?: string;

  /** Ed25519 over the canonical JSON of the rest of the record. Absent when the record is unsigned. */
  signature?: RecordSignature;
}

model RecordSignature {
  algorithm: "Ed25519";

  /** SHA-256 of the public key in DER, like "sha256:…". */
  @pattern("^sha256:")
  key: string;

  /** The signature in base64. */
  @minLength(1)
  value: string;
}

/** An error of an HTTP API (RFC 9457). */
model ApiProblem {
  /** A short summary, the same for every occurrence of the problem. */
  @minLength(1)
  title: string;

  /** The HTTP status code. */
  status: int32;

  /** What went wrong this time, for example the field that is missing. */
  detail?: string;
}
