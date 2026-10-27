// @ts-nocheck
// A submission becomes a work item (ADR 0063): the type defaults to "task", the dedupe key to the origin's link or
// ID, and the ID comes from the dedupe key, so the same key gives the same work item everywhere.
import { createHash } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import { validate, type WorkItem } from "@opensoftware/contracts";

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** "wi_" and 20 hex digits of the SHA-256 of the dedupe key. */
export const workItemId = (dedupeKey: string): string =>
  `wi_${createHash("sha256").update(dedupeKey).digest("hex").slice(0, 20)}`;

/** The key of a submission without one: the origin's link, else "<source>:<externalId>". */
function defaultKey(origin: unknown): string | undefined {
  if (!isObject(origin)) return undefined;
  if (typeof origin.url === "string") return origin.url;
  if (typeof origin.externalId === "string") return `${String(origin.source)}:${origin.externalId}`;
  return undefined;
}

/** The work item of a submission; a submission the contract refuses throws a usage error that names the fields. */
export function workItemOf(submission: unknown): WorkItem {
  if (!isObject(submission)) throw new UsageError("the submission is not a JSON object");
  const dedupeKey = submission.dedupeKey ?? defaultKey(submission.origin);
  const draft = { ...submission, id: "wi_", type: submission.type ?? "task", dedupeKey };
  const problems = validate("work-item", draft);
  if (problems.length) throw new UsageError(problems.map(({ path, message }) => `${path}: ${message}`).join("; "));
  return { ...draft, id: workItemId(dedupeKey as string) } as WorkItem;
}

/** One origin is listed once per work item: its source with its link, else with its ID. */
export const originKey = (origin: WorkItem["origin"]): string =>
  `${origin.source} ${origin.url ?? origin.externalId ?? ""}`;
