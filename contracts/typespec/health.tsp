// The health route that intake, gatekeeper and the foreman each serve (ADR 0086): the state of the server and of each
// system it needs. `console doctor` and the Compose profile's health checks read it.
import "@typespec/http";
import "./common.tsp";
import "./gatekeeper-api.tsp";

using TypeSpec.Http;

namespace Osf.Contracts;

/** One system a server needs, such as its database or NATS, and whether the server reaches it now. */
model HealthCheck {
  /** The system, like "database", "nats" or "temporal". */
  name: Name;

  ok: boolean;

  /** What failed and how to fix it, when `ok` is false. Never a secret. */
  detail?: string;
}

/** The state of a server: `ok` when every check is ok. */
model Health {
  status: "ok" | "failing";
  checks: HealthCheck[];
}

namespace HealthApi {
  /** The server's health. Needs no token, and names no secret. 503 when a check fails. */
  @route("/v1/health")
  @get
  @useAuth(NoAuth)
  op getHealth():
    | {
        @statusCode statusCode: 200;
        @body health: Health;
      }
    | {
        @statusCode statusCode: 503;
        @body health: Health;
      };
}
