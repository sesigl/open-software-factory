// @ts-nocheck
// The form "submit work" of the page /work (ADR 0089): its fields as a work submission for intake, with the person
// from the sign-in proxy as the requester. Intake checks the fields.
import type { WorkSubmission } from "@opensoftware/contracts";

export const submissionOf = (fields: Record<string, string | undefined>, person: string, at: string) =>
  ({
    title: fields.title,
    type: fields.type,
    description: fields.description || undefined,
    requester: { kind: "person", id: person },
    origin: { source: "console", externalId: `${person}/${at}` },
  }) as WorkSubmission;
