import "@typespec/json-schema";
import "./common.tsp";
import "./work-item.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/** intake: work to put into the inbox, a work item without its ID (ADR 0063). */
model WorkSubmission {
  /** Default: task. */
  type?: WorkItemType;

  @minLength(1)
  @maxLength(300)
  title: string;

  description?: string;
  requester: Actor;
  origin: Origin;

  /** Requests with the same key become one work item. Default: the origin's url, else "<source>:<externalId>". */
  @minLength(1)
  dedupeKey?: string;

  surface?: string;
  links?: Link[];
}

/** Where a work item stands. */
enum WorkItemStatus {
  received,
}

/** intake: one submission that asked for a work item. */
model WorkRequest {
  requester: Actor;
  origin: Origin;
  receivedAt: utcDateTime;
}

/** intake: a work item as the HTTP API shows it (ADR 0063). */
model WorkItemView {
  /** Its ID is "wi_" and 20 hex digits of the SHA-256 of its dedupe key. */
  workItem: WorkItem;

  status: WorkItemStatus;
  receivedAt: utcDateTime;

  /** Every submission that asked for the work item, oldest first; one per origin. */
  requests: WorkRequest[];
}
