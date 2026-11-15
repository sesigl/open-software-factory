// Shared setup of the person proof scenarios (ADR 0151): a call of the foreman's API with the API token and, given
// one, a proof in "OSF-Person", and an issuer's proof for such a call.
import type { FakePersonIssuer, Sut } from "@opensoftware/testkit";
import { AUTH } from "./foreman.ts";

/** POSTs the body, as JSON, to the path with the API token and, given one, the proof. */
export const posted = (sut: Sut, path: string, body: unknown, proof?: string) =>
  sut.http.request("POST", path, { body, headers: { ...AUTH, ...(proof ? { "OSF-Person": proof } : {}) } });

/** The issuer's proof of the person for a POST of the body to the path of the foreman, with these claims changed. */
export const proofOf = (
  issuer: FakePersonIssuer,
  sub: string,
  path: string,
  body: unknown,
  claims: Record<string, unknown> = {},
) => issuer.prove({ sub, aud: "foreman", path, body: JSON.stringify(body), ...claims });

/** The path of a run's signals. */
export const signals = (runId: string) => `/v1/runs/${runId}/signals`;
