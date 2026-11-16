// The approval record: who decided what and when. An Ed25519 signature over its canonical JSON shows that nobody
// changed it afterwards; anyone with the public key checks it.
import { createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject, sign, verify } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import type { GateRecord } from "@opensoftware/contracts";
import { deciderOf } from "./events.ts";
import type { Decided, Gate } from "./gate.ts";
import { canonical, sha256 } from "./json.ts";
import { toIso } from "./time.ts";

export type { GateRecord };

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
    decidedBy: outcome.state === "expired" ? undefined : deciderOf(outcome.by, outcome.name),
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

/** The record signed with the key, or as it is without a key. */
export const signWith = (record: GateRecord, key: string | undefined): GateRecord =>
  key ? signRecord(record, key) : record;

// The DER prefix of a PKCS #8 Ed25519 private key (RFC 8410); the 32 bytes of the seed follow it.
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

/**
 * The Ed25519 private key in GATEKEEPER_SIGNING_KEY: a key in PEM, as `gatekeeper keys` writes it, or its seed in 64
 * hex digits, like the output of `openssl rand -hex 32`. Else a usage error that says what is wrong with it.
 */
export function signingKeyOf(privateKeyPem: string): KeyObject {
  if (/^[0-9a-fA-F]{64}$/.test(privateKeyPem))
    return createPrivateKey({
      key: Buffer.concat([PKCS8_ED25519, Buffer.from(privateKeyPem, "hex")]),
      format: "der",
      type: "pkcs8",
    });
  let key: KeyObject;
  try {
    key = createPrivateKey(privateKeyPem);
  } catch {
    throw new UsageError("GATEKEEPER_SIGNING_KEY is no private key in PEM");
  }
  if (key.asymmetricKeyType !== "ed25519") throw new UsageError("GATEKEEPER_SIGNING_KEY must be an Ed25519 key");
  return key;
}

export function signRecord(record: GateRecord, privateKeyPem: string): GateRecord {
  const key = signingKeyOf(privateKeyPem);
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
