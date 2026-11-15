// Shared setup of the scenarios of the person proof (ADR 0151): a server that checks the proofs of the issuers in
// GATEKEEPER_PERSON_KEYS, and decisions posted as the bytes the caller chose.
import type { Fakes, Sut } from "@opensoftware/testkit";
import { AUTH, askedServer } from "./server.ts";

export const ADA = "ada@acme.dev";
export const GRACE = "grace@acme.dev";

const groupsOf = (member: string) =>
  JSON.stringify({ maintainers: [member], reviewers: [member], leads: ["slack:U0LEO"] });

/** A decision's body as indented JSON, so a digest over JSON parsed and written again does not match it. */
export const decisionBody = (by: { kind: string; id: string }, decision = "approved"): string =>
  JSON.stringify({ decision, by }, null, 2);

/** A person as the body's "by". */
export const person = (id: string) => ({ kind: "person", id });

/**
 * The server with GATEKEEPER_PERSON_KEYS set to `setting` asked "maintainers", whose member is `member`, for approval
 * of the README request.
 */
export async function checkingServer(sut: Sut, fakes: Fakes, setting: string, member = ADA) {
  const server = await askedServer(sut, fakes, {
    env: { GATEKEEPER_PERSON_KEYS: setting },
    change: { "groups.json": groupsOf(member) },
  });
  return { ...server, path: `/v1/gates/${server.id}/decisions` };
}

/** Posts a decision of the gate as these bytes, with the API token and, when there is one, the proof in OSF-Person. */
export const postDecision = (
  server: Awaited<ReturnType<typeof askedServer>>,
  body: string,
  proof?: string,
): ReturnType<ReturnType<typeof server.api>["POST"]> =>
  server.api().POST("/v1/gates/{gateId}/decisions", {
    params: { path: { gateId: server.id } },
    body: {} as never,
    bodySerializer: () => body,
    headers: { ...AUTH, ...(proof ? { "OSF-Person": proof } : {}) },
  });

/** The detail of a problem the server answered. */
export const detailOf = (answer: { error?: unknown }): string | undefined =>
  (answer.error as { detail?: string } | undefined)?.detail;
