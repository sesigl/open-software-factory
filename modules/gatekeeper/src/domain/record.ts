// The approval record: who decided what and when. An Ed25519 signature over its canonical JSON shows that nobody
// changed it afterwards; anyone with the public key checks it.
import { createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject, sign, verify } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import type { Decided, Gate } from "./gate.ts";
import { canonical, sha256 } from "./json.ts";
import { toIso } from "./time.ts";

export interface GateRecord {
  gate: string;
  workItem: string;
  stage: string;
  summary: string;
  /** SHA-256 of the canonical request: what was approved. */
  request: string;
  policy: string;
  /** SHA-256 of the policy's text: the rules that picked the approvers. */
  policyDigest: string;
  risk?: string;
  approvers: string[];
  channel: string;
  requestedAt: string;
  decision: "approved" | "rejected" | "expired";
  decidedBy?: { kind: "person" | "trigger"; id: string };
  decidedAt: string;
  reason?: string;
  signature?: { algorithm: "Ed25519"; key: string; value: string };
}

export function buildRecord(
  gate: Gate,
  context: { policyText: string; channel: string; requestedAt: number },
  outcome: Decided,
): GateRecord {
  const { request, rules } = gate;
  return {
    gate: gate.id,
    workItem: request.workItem,
    stage: request.stage,
    summary: request.summary,
    request: `sha256:${sha256(canonical(request))}`,
    policy: gate.policy,
    policyDigest: `sha256:${sha256(context.policyText)}`,
    risk: rules.risk,
    approvers: rules.approvers,
    channel: context.channel,
    requestedAt: toIso(context.requestedAt),
    decision: outcome.state,
    decidedBy:
      outcome.state === "expired"
        ? undefined
        : { kind: outcome.by.startsWith("policy:") ? "trigger" : "person", id: outcome.by },
    decidedAt: toIso(outcome.at),
    reason: outcome.state === "rejected" ? outcome.reason : undefined,
  };
}

const keyId = (key: KeyObject): string =>
  `sha256:${sha256(key.export({ type: "spki", format: "der" }).toString("base64"))}`;

const signedText = (record: GateRecord): Buffer => {
  const { signature: _, ...rest } = record;
  return Buffer.from(canonical(rest));
};

export function signRecord(record: GateRecord, privateKeyPem: string): GateRecord {
  let key: KeyObject;
  try {
    key = createPrivateKey(privateKeyPem);
  } catch {
    throw new UsageError("GATEKEEPER_SIGNING_KEY is no private key in PEM");
  }
  if (key.asymmetricKeyType !== "ed25519") throw new UsageError("GATEKEEPER_SIGNING_KEY must be an Ed25519 key");
  const value = sign(null, signedText(record), key).toString("base64");
  return { ...record, signature: { algorithm: "Ed25519", key: keyId(createPublicKey(key)), value } };
}

/** undefined when the signature holds, else why not. */
export function verifyRecord(record: GateRecord, publicKeyPem: string): string | undefined {
  const key = createPublicKey(publicKeyPem);
  const { signature } = record;
  if (!signature?.value) return "the record has no signature";
  if (signature.key !== keyId(key)) return "the record was signed with another key";
  return verify(null, signedText(record), key, Buffer.from(signature.value, "base64"))
    ? undefined
    : "the signature does not match";
}

export function newKeyPair(): { privateKey: string; publicKey: string } {
  return generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}
