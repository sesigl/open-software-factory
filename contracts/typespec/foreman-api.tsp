// The HTTP API of `foreman serve` (ADR 0067). `pnpm build` compiles it with the OpenAPI 3 emitter and copies its paths
// into openapi/openapi.json, next to gatekeeper's and intake's; the models are the named models of the JSON Schema
// bundle.
import "@typespec/http";
import "./foreman.tsp";
import "./gatekeeper-api.tsp";

using TypeSpec.Http;

namespace Osf.Contracts;

namespace ForemanApi {
  /** Start a run of the factory's workflow for a work item. The same work item again answers its newest run. */
  @route("/v1/runs")
  @post
  op startRun(@body workItem: WorkItem):
    | {
        @statusCode statusCode: 201;
        @body run: RunView;
      }
    | {
        @statusCode statusCode: 200;
        @body run: RunView;
      }
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>;

  /**
   * A page of the runs of the server, running runs first, then the runs that ended, the one that ended last first; with
   * `state`, only the runs in that state (ADR 0071). `limit` runs at most, 50 by default; `cursor` is the `next` of the
   * page before (ADR 0115). With `state`, a page may hold fewer runs than `limit` and still have a `next`.
   */
  @route("/v1/runs")
  @get
  op listRuns(
    @query state?: RunState,
    @query @minValue(1) @maxValue(500) limit?: int32,
    @query @minLength(1) cursor?: string,
  ): RunList | GatekeeperApi.Failure<400> | GatekeeperApi.Failure<401>;

  /** A run: its state and the state of each stage. */
  @route("/v1/runs/{runId}")
  @get
  op getRun(@path runId: string): RunView | GatekeeperApi.Failure<401> | GatekeeperApi.Failure<404>;

  /** Steer the running stage's agent, or cancel the run. */
  @route("/v1/runs/{runId}/signals")
  @post
  op signalRun(@path runId: string, @body signal: RunSignal):
    | {
        @statusCode statusCode: 202;
        @body run: RunView;
      }
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>
    | GatekeeperApi.Failure<404>
    | GatekeeperApi.Failure<409>;

  /** Run a run that failed or was cancelled again, as a new run that names it (ADR 0105). */
  @route("/v1/runs/{runId}/retry")
  @post
  op retryRun(@path runId: string, @body retry: RunRetry):
    | {
        @statusCode statusCode: 201;
        @body run: RunView;
      }
    | GatekeeperApi.Failure<400>
    | GatekeeperApi.Failure<401>
    | GatekeeperApi.Failure<404>
    | GatekeeperApi.Failure<409>;
}
