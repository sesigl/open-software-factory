// The person, proven (ADR 0151): with INTAKE_PERSON_KEYS, a submission whose requester is a person needs the proof of
// that person in OSF-Person, signed by an issuer of the setting. A requester of the kind "trigger" needs none.
import { UsageError } from "@opensoftware/cli";
import { type PersonCheck, personChecker } from "@opensoftware/person-proof";
import { workItemOf } from "../domain/work-item.ts";
import type { Env } from "./env.ts";

/** A request to POST /v1/work-items: its headers, path and body's bytes, before the body was parsed. */
export interface Submitted {
  headers: Record<string, string | string[] | undefined>;
  path: string;
  body: Buffer;
  /** The parsed body. */
  submission: unknown;
}

/** The submission with the requester to record, or the refusal to answer. */
export type Proven = { ok: true; submission: unknown } | Extract<PersonCheck, { ok: false }>;

/**
 * The check of the submissions from INTAKE_PERSON_KEYS, at the module's clock. Without the setting every submission
 * passes, as before the setting, and the server says so once. A malformed setting is a usage error that names it.
 */
export function personCheckOf(env: Env, now: () => number, warn: (text: string) => void) {
  const setting = env.INTAKE_PERSON_KEYS;
  if (!setting) {
    warn("INTAKE_PERSON_KEYS is not set: a caller with the API token names any person (ADR 0151)");
    return async (request: Submitted): Promise<Proven> => ({ ok: true, submission: request.submission });
  }
  let checker: ReturnType<typeof personChecker>;
  try {
    checker = personChecker(setting, { audience: "intake", now: () => new Date(now()) });
  } catch (error) {
    throw new UsageError(`INTAKE_PERSON_KEYS: ${(error as Error).message}`);
  }
  return async ({ headers, path, body, submission }: Submitted): Promise<Proven> => {
    // A submission the contract refuses is a 400 before any proof: it names no requester to prove.
    const { requester } = workItemOf(submission);
    const check = await checker.check({ headers, method: "POST", path, body, actor: requester });
    if (!check.ok) return check;
    return { ok: true, submission: { ...(submission as object), requester: check.actor } };
  };
}

export type PersonCheckOf = ReturnType<typeof personCheckOf>;
