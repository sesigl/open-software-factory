// The form "submit work" of the page /work (ADR 0089): its fields as a work submission for intake, with the person
// from the sign-in proxy as the requester.
import type { WorkSubmission } from "@opensoftware/contracts";

const TYPES = ["task", "bug", "idea", "automation"];

/** The submission of the form's fields, or what is wrong with them. */
export function submissionOf(
  fields: Record<string, string | undefined>,
  person: string,
  at: string,
): WorkSubmission | string {
  const title = fields.title?.trim() ?? "";
  if (!title) return "title: give the work a title";
  if (title.length > 300) return "title: at most 300 characters";
  const type = fields.type || "task";
  if (!TYPES.includes(type)) return `type: one of ${TYPES.join(", ")}`;
  const description = fields.description?.trim();
  return {
    title,
    type: type as WorkSubmission["type"],
    ...(description ? { description } : {}),
    requester: { kind: "person", id: person },
    origin: { source: "console", externalId: `${person}/${at}` },
  };
}
