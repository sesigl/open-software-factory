// A module's side (ADR 0151): a request's proof checked against the key sets of the issuers the module knows.
import { type components, type PersonProof, type Problem, validate } from "@opensoftware/contracts";
import { createRemoteJWKSet, customFetch, decodeJwt, decodeProtectedHeader, type JWTPayload, jwtVerify } from "jose";
import { bodyDigest, issuerUrls, PERSON_HEADER, PROOF_ALG, PROOF_TYPE, withoutQuery } from "./keys.ts";

export type Actor = components["schemas"]["Actor"];

/** The clock difference a module allows on `iat` and `exp`, in seconds. */
const SKEW = 10;
/** The longest a proof may live, from `iat` to `exp`, in seconds. */
const LONGEST = 60;
const MISSING = `send ${PERSON_HEADER}: the console's proof of the person (ADR 0151)`;

export interface CheckerOptions {
  /** This module's name, the `aud` a proof must name, like "foreman". */
  audience: string;
  /** The clock: OSF_NOW in tests. Default: the system's clock. */
  now?: () => Date;
}

/** One request of a module API, as it arrived. */
export interface PersonRequest {
  /** The request's headers; a name in any case. */
  headers: Record<string, string | string[] | undefined>;
  /** In upper case, as Node gives it. */
  method: string;
  /** The request's path as in the request line; a query is left out. */
  path: string;
  /** The body's bytes as they arrived, before they are parsed. */
  body: string | Uint8Array;
  /** The actor the body names, like `requester` or `by`. */
  actor: Actor;
  /** A proof is needed whatever kind the actor is, as for a gate decision. Default: only for a person. */
  always?: boolean;
}

/** What the module does with the request: record `actor`, or answer `status` with `reason`. */
export type PersonCheck =
  | { ok: true; actor: Actor; proof?: PersonProof }
  | { ok: false; status: 401 | 403 | 503; reason: string; sub: string };

export interface PersonChecker {
  check(request: PersonRequest): Promise<PersonCheck>;
}

/** A key set that cannot be fetched, or is no `person-keys`: the issuer's fault, not the person's. */
class Unreachable extends Error {}

const quoted = (value: unknown): string => String(JSON.stringify(value));
/** The problems of a document against its format, each with its path. */
const listed = (problems: Problem[]): string =>
  problems.map((problem) => `${problem.path} ${problem.message}`).join("; ");
const time = (seconds: number): string => new Date(seconds * 1000).toISOString().replace(".000Z", "Z");

/** Fetches a key set for jose, and refuses one that is no `person-keys` of the contracts. */
const keySetFetch =
  (name: string, url: URL) =>
  async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const cannot = `cannot fetch the key set of the issuer "${name}" at ${url.href}`;
    let response: Response;
    try {
      response = await fetch(input, init);
    } catch (failure) {
      const error = failure as Error & { cause?: Error };
      throw new Unreachable(`${cannot}: ${error.cause?.message ?? error.message}`);
    }
    if (response.status !== 200) throw new Unreachable(`${cannot}: HTTP ${response.status}`);
    const keys: unknown = await response.json().catch(() => undefined);
    const problems = validate("person-keys", keys);
    if (problems.length > 0) {
      throw new Unreachable(
        `the key set of the issuer "${name}" at ${url.href} is not valid person-keys: ${listed(problems)}`,
      );
    }
    return Response.json(keys);
  };

/**
 * A checker from a module's setting: `name=url` pairs of the issuers' key sets, separated by commas. Each key set is
 * fetched when it is first needed, kept for 10 minutes and fetched again for an unknown key at most once in 30
 * seconds. A malformed setting throws a SettingError.
 */
export function personChecker(setting: string, options: CheckerOptions): PersonChecker {
  const keySets = new Map(
    [...issuerUrls(setting)].map(([name, url]) => [
      name,
      createRemoteJWKSet(url, { [customFetch]: keySetFetch(name, url) }),
    ]),
  );
  const now = options.now ?? (() => new Date());
  const { audience } = options;

  return {
    async check(request) {
      const { actor } = request;
      if (!request.always && actor.kind !== "person") return { ok: true, actor };
      const proof = headerOf(request.headers);
      if (!proof) return { ok: false, status: 401, reason: MISSING, sub: actor.id };
      let header: ReturnType<typeof decodeProtectedHeader>;
      let claims: JWTPayload;
      try {
        header = decodeProtectedHeader(proof);
        claims = decodeJwt(proof);
      } catch {
        return { ok: false, status: 401, reason: "the person proof is not a JSON Web Token", sub: actor.id };
      }
      const sub = typeof claims.sub === "string" ? claims.sub : actor.id;
      const refuse = (status: 401 | 403 | 503, reason: string): PersonCheck => ({ ok: false, status, reason, sub });
      if (header.typ !== PROOF_TYPE) {
        return refuse(401, `the person proof's typ is ${quoted(header.typ)}, not "${PROOF_TYPE}"`);
      }
      if (header.alg !== PROOF_ALG) {
        return refuse(401, `the person proof's alg is ${quoted(header.alg)}, not "${PROOF_ALG}"`);
      }
      const issuer = claims.iss as string;
      const keySet = keySets.get(issuer);
      if (!keySet) {
        const names = [...keySets.keys()].map(quoted).join(", ");
        return refuse(401, `the person proof's issuer ${quoted(claims.iss)} is not one of ${names}`);
      }
      const at = now();
      try {
        await jwtVerify(proof, keySet, {
          algorithms: [PROOF_ALG],
          typ: PROOF_TYPE,
          issuer,
          audience,
          currentDate: at,
          clockTolerance: SKEW,
        });
      } catch (failure) {
        if (failure instanceof Unreachable) return refuse(503, failure.message);
        return refuse(401, refusal(failure as Error & { code?: string; claim?: string }, claims, header.kid, audience));
      }
      const problems = validate("person-proof", claims);
      if (problems.length > 0) {
        return refuse(401, `the person proof's claims are not valid person-proof: ${listed(problems)}`);
      }
      const valid = claims as PersonProof;
      if (valid.exp - valid.iat > LONGEST) {
        return refuse(401, `the person proof lives ${valid.exp - valid.iat} seconds, longer than ${LONGEST}`);
      }
      if (valid.iat > at.getTime() / 1000 + SKEW) {
        return refuse(401, `the person proof was signed at ${time(valid.iat)}, after ${at.toISOString()}`);
      }
      const mismatch = differs(valid, request);
      if (mismatch) return refuse(403, mismatch);
      return {
        ok: true,
        actor: { kind: "person", id: valid.sub, ...(valid.name ? { displayName: valid.name } : {}) },
        proof: valid,
      };
    },
  };
}

/** The header's value, or "" without it; a repeated header is one value with commas, as Node joins it. */
function headerOf(headers: PersonRequest["headers"]): string {
  const wanted = PERSON_HEADER.toLowerCase();
  return String(Object.entries(headers).find(([name]) => name.toLowerCase() === wanted)?.[1] ?? "");
}

/** The reason for a proof that jose did not verify. */
function refusal(
  failure: Error & { code?: string; claim?: string },
  claims: JWTPayload,
  kid: string | undefined,
  audience: string,
): string {
  if (failure.code === "ERR_JWT_EXPIRED") return `the person proof ended at ${time(Number(claims.exp))}`;
  if (failure.code === "ERR_JWKS_NO_MATCHING_KEY") {
    return `the person proof's key ${quoted(kid)} is not in the key set of the issuer ${quoted(claims.iss)}`;
  }
  if (failure.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
    return `the person proof's signature does not verify with the key set of the issuer ${quoted(claims.iss)}`;
  }
  if (failure.claim === "aud") return `the person proof is for ${quoted(claims.aud)}, not "${audience}"`;
  return `the person proof does not verify: ${failure.message}`;
}

/** The claim of a valid proof that does not match the request, or undefined. */
function differs(proof: PersonProof, request: PersonRequest): string | undefined {
  const { method } = request;
  if (proof.method !== method) return `the person proof's method "${proof.method}" is not this request's "${method}"`;
  const path = withoutQuery(request.path);
  if (proof.path !== path) return `the person proof's path "${proof.path}" is not this request's "${path}"`;
  if (proof.bodyDigest !== bodyDigest(request.body)) return "the person proof's bodyDigest is not this request's body";
  if (proof.sub !== request.actor.id)
    return `the person proof's sub "${proof.sub}" is not the actor "${request.actor.id}"`;
  return undefined;
}
