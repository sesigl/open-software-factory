// The issuer's side (ADR 0151): the key set to publish, and a proof for a person, a role, a module and a request.
import type { AccessRole, PersonKeys } from "@opensoftware/contracts";
import { SignJWT } from "jose";
import { bodyDigest, PROOF_ALG, PROOF_TYPE, publicKey, signingKeys } from "./keys.ts";

/** How long a proof lives, in seconds. */
const LIFETIME = 30;

export interface SignerOptions {
  /** The issuer's name, the proofs' `iss`. Default "console". */
  issuer?: string;
  /** The clock. Default: the system's clock. */
  now?: () => Date;
}

/** One call of a module in a person's name. */
export interface PersonCall {
  /** The person, the proof's `sub`: the email in lower case, or the sign-in proxy's value. */
  person: string;
  /** The name to show, the proof's `name`. */
  name?: string;
  role: AccessRole;
  /** The module the call goes to, like "foreman". */
  audience: string;
  /** The request's method in upper case, like "POST". */
  method: string;
  /** The request's path as sent, without a query. */
  path: string;
  /** The request's body as it is sent. */
  body: string | Uint8Array;
}

export interface PersonSigner {
  /** The key set to publish at `/.well-known/jwks.json`: every key of the setting. */
  keys: PersonKeys;
  /** The proof for the header `OSF-Person`, signed with the first key, for 30 seconds from now. */
  prove(call: PersonCall): Promise<string>;
}

/**
 * A signer from a setting of Ed25519 seeds, each 64 hex digits, separated by commas: the first signs, every one is
 * published. A malformed setting throws a SettingError.
 */
export async function personSigner(setting: string, options: SignerOptions = {}): Promise<PersonSigner> {
  const keys = signingKeys(setting);
  const published = await Promise.all(keys.map(publicKey));
  const now = options.now ?? (() => new Date());
  const issuer = options.issuer ?? "console";
  const [signing] = keys as [(typeof keys)[number]];
  const [{ kid }] = published as [PersonKeys["keys"][number]];
  return {
    keys: { keys: published },
    async prove(call) {
      const iat = Math.floor(now().getTime() / 1000);
      return new SignJWT({
        ...(call.name ? { name: call.name } : {}),
        role: call.role,
        method: call.method,
        path: call.path,
        bodyDigest: bodyDigest(call.body),
      })
        .setProtectedHeader({ alg: PROOF_ALG, kid, typ: PROOF_TYPE })
        .setIssuer(issuer)
        .setSubject(call.person)
        .setAudience(call.audience)
        .setIssuedAt(iat)
        .setExpirationTime(iat + LIFETIME)
        .sign(signing);
    },
  };
}
