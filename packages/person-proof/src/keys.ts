// The settings of a person proof (ADR 0151): the signing keys, the issuers' key sets, and what binds a proof to one
// request.
import { createHash, createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import type { PersonKey } from "@opensoftware/contracts";
import { calculateJwkThumbprint } from "jose";

/** The `typ` of a person proof (explicit typing, RFC 8725). */
export const PROOF_TYPE = "osf-person+jwt";
/** The fully specified name of EdDSA with Ed25519 (RFC 9864), the only `alg` of a person proof. */
export const PROOF_ALG = "Ed25519";
/** The request header that carries a proof. */
export const PERSON_HEADER = "OSF-Person";

/** A setting of the person proof that cannot be read. Its message never holds a key. */
export class SettingError extends Error {
  override name = "SettingError";
}

// The DER prefix of a PKCS #8 Ed25519 private key (RFC 8410); the 32 bytes of the seed follow it.
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

/** The private keys of a signing setting: seeds of 64 hex digits, separated by commas; the first signs. */
export function signingKeys(setting: string): KeyObject[] {
  const seeds = setting.split(",").map((seed) => seed.trim());
  return seeds.map((seed, index) => {
    if (!/^[0-9a-fA-F]{64}$/.test(seed)) {
      throw new SettingError(
        `a signing key is 64 hex digits, the seed of an Ed25519 key: key ${index + 1} of ${seeds.length} is not`,
      );
    }
    return createPrivateKey({
      key: Buffer.concat([PKCS8_ED25519, Buffer.from(seed, "hex")]),
      format: "der",
      type: "pkcs8",
    });
  });
}

/** The public key of a private key, as the format `person-keys` publishes it, with its thumbprint as `kid`. */
export async function publicKey(key: KeyObject): Promise<PersonKey> {
  const { x } = createPublicKey(key).export({ format: "jwk" });
  const kid = await calculateJwkThumbprint({ kty: "OKP", crv: "Ed25519", x }, "sha256");
  return { kty: "OKP", crv: "Ed25519", alg: PROOF_ALG, use: "sig", kid, x: x as string };
}

const NAME = /^[a-z][a-z0-9-]{0,62}$/;

/** The key sets of a module's setting: `name=url` pairs, separated by commas, by the issuer's name. */
export function issuerUrls(setting: string): Map<string, URL> {
  const issuers = new Map<string, URL>();
  for (const entry of setting.split(",").map((part) => part.trim())) {
    const at = entry.indexOf("=");
    const name = entry.slice(0, at);
    const url = URL.parse(entry.slice(at + 1));
    // Without "=", the URL is the whole pair, which is no URL of HTTP.
    if (!NAME.test(name) || !["http:", "https:"].includes(String(url?.protocol))) {
      throw new SettingError(
        `a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "${entry}" is not`,
      );
    }
    issuers.set(name, url as URL);
  }
  return issuers;
}

/** The SHA-256 of a body's bytes, in base64url without padding. */
export const bodyDigest = (body: string | Uint8Array): string => createHash("sha256").update(body).digest("base64url");

/** A path as a proof names it: without the query. */
export const withoutQuery = (path: string): string => path.split("?")[0] as string;
