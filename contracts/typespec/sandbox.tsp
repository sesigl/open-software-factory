import "@typespec/json-schema";
import "./common.tsp";
import "./factory-definition.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

// The sandbox spec is written by a program (foreman) for a sandbox adapter, and a sandbox must never get more than
// it asked for: every object is closed, so an unknown field is an error and not a silent grant.

/**
 * The input of a sandbox adapter's `create` (ADR 0054): what one sandbox runs, how much it may use, and what it may
 * reach. Realizes SCN-FACTORY-RUNTIME-004, -006 and -007.
 */
@extension("additionalProperties", Json<false>)
model SandboxSpec {
  /** What the sandbox starts from: an image for the docker adapter, a SandboxTemplate for kubernetes, or a snapshot. */
  @minLength(1)
  template: string;

  /** CPU cores. The smallest unit is 0.001 (one millicore). */
  @minValue(0.001)
  cpu?: float64;

  /** Kubernetes quantity, for example "8Gi". */
  @pattern("^[0-9]+(Ki|Mi|Gi|Ti)?$")
  memory?: string;

  /** Hostnames the sandbox may reach through its egress proxy. Everything else is refused. */
  egress?: Hostname[];

  /** Variables of the sandbox's environment that hold no secret. */
  env?: Record<string>;

  /**
   * Secrets by the name of the variable that holds the placeholder in the sandbox. The egress proxy puts the real
   * value in on the way out, for the hosts of `egress`.
   */
  secrets?: Record<SecretReference>;

  /** The MCP servers the sandbox may call. A call to any other MCP server is refused. */
  mcp?: SandboxMcpServer[];
}

/** A hostname without scheme or port, for example "api.linear.app". */
@pattern("^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$")
scalar Hostname extends string;

/** An MCP server that a sandbox may call over Streamable HTTP. */
@extension("additionalProperties", Json<false>)
model SandboxMcpServer {
  /** The name in the egress log, for example "wiki". */
  name: Name;

  /** The server's endpoint, for example "https://wiki.example.com/mcp". */
  @pattern("^https?://[^/]+")
  url: string;

  /** The tools the sandbox may call. A call to any other tool is refused. */
  @minItems(1)
  tools: string[];
}
