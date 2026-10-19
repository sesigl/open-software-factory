import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

// Wire formats (work item, run record, evidence manifest, score, events) are open: consumers ignore fields they
// do not know, so producers can add optional fields in a minor version.

/** One unit of requested work: the `data` of a `work.received@v1` CloudEvent. */
model WorkItem {
  id: Identifier;
  type: WorkItemType;

  @minLength(1)
  @maxLength(300)
  title: string;

  description?: string;

  /** The person or trigger that asked for the work. */
  requester: Actor;

  /** Where the work came from. */
  origin: Origin;

  /** Requests with the same key become one work item, for example "github:acme/web#42". */
  @minLength(1)
  dedupeKey: string;

  /** Product surface the work is about, for example "checkout". */
  surface?: string;

  /** Set by triage. */
  priority?: Priority;

  /** Related material: an error report, a change, a document. */
  links?: Link[];
}

enum WorkItemType {
  idea,
  bug,
  task,
  automation,
}

enum Priority {
  urgent,
  high,
  normal,
  low,
}

model Origin {
  /** The channel or system, for example "slack", "github", "sentry", "cron", "mcp". */
  source: Name;

  /** Link back to the origin, for example the Slack thread. Absent for a schedule. */
  url?: url;

  /** ID in the source system. */
  externalId?: string;
}
