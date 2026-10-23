// The HTTP API of `gatekeeper serve` (ADR 0048). `pnpm build` compiles it with the OpenAPI 3 emitter and copies its
// paths into openapi/openapi.json; the models are the named models of the JSON Schema bundle.
import "@typespec/http";
import "./gatekeeper.tsp";

using TypeSpec.Http;

@service(#{ title: "Open Software Factory contracts" })
@useAuth(BearerAuth)
namespace Osf.Contracts;

namespace GatekeeperApi {
  @error
  model Failure<Code extends int32> {
    @statusCode statusCode: Code;
    @header contentType: "application/problem+json";
    @body problem: ApiProblem;
  }

  /** Ask the policy's approver groups for a decision. The same request again answers the gate it made before. */
  @route("/v1/gates")
  @post
  op requestGate(@body request: GateRequest):
    | {
        @statusCode statusCode: 201;
        @body gate: GateView;
      }
    | {
        @statusCode statusCode: 200;
        @body gate: GateView;
      }
    | Failure<400>
    | Failure<401>;

  /** A gate: its state, and its record once it is decided. */
  @route("/v1/gates/{gateId}")
  @get
  op getGate(@path gateId: string): GateView | Failure<401> | Failure<404>;
}
