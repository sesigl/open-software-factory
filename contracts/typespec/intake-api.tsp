// The HTTP API of `intake serve` (ADR 0063). `pnpm build` compiles it with the OpenAPI 3 emitter and copies its paths
// into openapi/openapi.json, next to gatekeeper's; the models are the named models of the JSON Schema bundle.
import "@typespec/http";
import "./intake.tsp";
import "./gatekeeper-api.tsp";

using TypeSpec.Http;

namespace Osf.Contracts;

namespace IntakeApi {
  /** Put work into the inbox. A submission with the dedupe key of a work item answers that work item. */
  @route("/v1/work-items")
  @post
  op submitWork(@body submission: WorkSubmission):
    | {
        @statusCode statusCode: 201;
        @body workItem: WorkItemView;
      }
    | {
        @statusCode statusCode: 200;
        @body workItem: WorkItemView;
      }
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>;

  /** A work item, its status and every request that asked for it. */
  @route("/v1/work-items/{workItemId}")
  @get
  op getWorkItem(@path workItemId: string): WorkItemView | GatekeeperApi.Failure<401> | GatekeeperApi.Failure<404>;
}
