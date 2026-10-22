// gatekeeper keys: a new Ed25519 key pair for GATEKEEPER_SIGNING_KEY and verify --public-key.
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { writeText } from "@opensoftware/cli";
import { newKeyPair } from "../domain/record.ts";

export function keys(folder: string) {
  const { privateKey, publicKey } = newKeyPair();
  const pem = join(folder, "gatekeeper.pem");
  const pub = join(folder, "gatekeeper.pub");
  writeText(pem, privateKey);
  chmodSync(pem, 0o600);
  writeText(pub, publicKey);
  return { lines: [`wrote the private key ${pem} and the public key ${pub}`] };
}
