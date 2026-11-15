// What the scenarios of person-proof share: the clock, made-up seeds, a request and a served key set.
import {
  type Actor,
  type PersonCheck,
  type PersonChecker,
  type PersonRequest,
  type PersonSigner,
  personChecker,
} from "@opensoftware/person-proof";
import type { FakeHttp, FakePersonIssuer, Fakes } from "@opensoftware/testkit";

/** The testkit's clock, as fakes.personIssuer signs on it, and that clock `seconds` later. */
export const NOW = Date.parse("2026-01-01T00:00:00Z");
export const at = (seconds: number) => () => new Date(NOW + seconds * 1000);
/** The same clock in seconds since 1970, a proof's `iat`. */
export const IAT = NOW / 1000;

/** Made-up seeds of signing keys, never used outside these tests. */
export const SEED = "0123456789abcdef".repeat(4);
export const OTHER_SEED = "fedcba9876543210".repeat(4);

export const ADA: Actor = { kind: "person", id: "ada@acme.dev" };
export const PATH = "/v1/runs/run_1/signals";
export const BODY = '{"signal":"approve"}';

/** A POST of BODY to PATH for Ada with `proof` in OSF-Person, with `changes`. */
export const request = (proof: string, changes: Partial<PersonRequest> = {}): PersonRequest => ({
  headers: { "OSF-Person": proof },
  method: "POST",
  path: PATH,
  body: BODY,
  actor: ADA,
  ...changes,
});

/** The key set of a signer, served by fakes.http at `/.well-known/jwks.json`. */
export const served = (fakes: Fakes, signer: PersonSigner): Promise<FakeHttp> =>
  fakes.http([{ path: "/.well-known/jwks.json", body: signer.keys }]);

/** The claims of a proof for `request()`: Ada, the foreman, PATH and BODY. */
export const CLAIMS = { sub: ADA.id, aud: "foreman", path: PATH, body: BODY };

/** fakes.personIssuer "console", and a checker of the foreman with its setting on the clock `seconds` later. */
export async function foremanOf(
  fakes: Fakes,
  seconds = 0,
): Promise<{ issuer: FakePersonIssuer; checker: PersonChecker }> {
  const issuer = await fakes.personIssuer();
  return { issuer, checker: personChecker(issuer.setting, { audience: "foreman", now: at(seconds) }) };
}

/** A refusal as a check gives it. */
export const refused = (status: number, reason: string, sub = ADA.id): PersonCheck =>
  ({ ok: false, status, reason, sub }) as PersonCheck;
