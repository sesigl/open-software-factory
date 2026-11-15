// The HTTP API of `intake serve` (ADR 0063). `pnpm build` compiles it with the OpenAPI 3 emitter and copies its paths
// into openapi/openapi.json, next to gatekeeper's; the models are the named models of the JSON Schema bundle.
import "@typespec/http";
import "./intake.tsp";
import "./gatekeeper-api.tsp";

using TypeSpec.Http;

namespace Osf.Contracts;

namespace IntakeApi {
  /**
   * Put work into the inbox. A submission with the dedupe key of a work item answers that work item. With
   * `INTAKE_PERSON_KEYS`, a requester of the kind `person` needs its proof in `OSF-Person` (ADR 0151): 401 without one
   * or for one that does not verify, 403 for one of another request or person, 503 when its issuer's key set cannot be
   * fetched.
   */
  @route("/v1/work-items")
  @post
  op submitWork(
    /** The person proof of the requester: a JSON Web Token with the claims of `PersonProof` (ADR 0151). */
    @header("OSF-Person") personProof?: string,

    @body submission: WorkSubmission,
  ):
    | {
        @statusCode statusCode: 201;
        @body workItem: WorkItemView;
      }
    | {
        @statusCode statusCode: 200;
        @body workItem: WorkItemView;
      }
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>
    | GatekeeperApi.Failure<403>
    | GatekeeperApi.Failure<503>;

  /** The work item with this dedupe key, such as an issue's link (ADR 0065). */
  @route("/v1/work-items")
  @get
  op findWorkItem(@query dedupeKey: string):
    | WorkItemView
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>
    | GatekeeperApi.Failure<404>;

  /**
   * A page of the latest work items, the one received last first; with `status`, only the work items in that status.
   * `limit` work items at most, 50 by default; `cursor` is the `next` of the page before (ADR 0115).
   */
  @route("/v1/inbox")
  @get
  op listWorkItems(
    @query status?: WorkItemStatus,
    @query @minValue(1) @maxValue(500) limit?: int32,
    @query @minLength(1) cursor?: string,
  ):
    | WorkItemList
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>;

  /** A work item, its status and every request that asked for it. */
  @route("/v1/work-items/{workItemId}")
  @get
  op getWorkItem(@path workItemId: string): WorkItemView | GatekeeperApi.Failure<401> | GatekeeperApi.Failure<404>;
}
