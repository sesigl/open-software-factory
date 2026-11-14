import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/**
 * factory.lock next to factory.yaml (ADR 0020, ADR 0125): the exact versions that `factory plan` pinned. factory-spec
 * writes it; the foreman reads the pins of its adapters.
 */
model FactoryLock {
  /** The version of the lock's format. */
  version: 1;

  /** The registry MCP servers, by their reference in factory.yaml, for example `registry:io.github.acme/tracker@1.4`. */
  mcp: Record<FactoryLockMcpPin>;

  /**
   * The adapters under `providers` that `factory plan --adapters` pinned, per port and adapter name (ADR 0125). A pin
   * counts only while its `range` is the range factory.yaml declares.
   */
  adapters?: Record<Record<FactoryLockAdapterPin>>;
}

/** One registry MCP server at its exact version, with the npm package or the remote it starts. */
model FactoryLockMcpPin {
  @minLength(1)
  name: string;

  @minLength(1)
  version: string;

  package?: {
    registryType: "npm";
    @minLength(1) identifier: string;
    @minLength(1) version: string;
  };

  remote?: {
    @minLength(1) type: string;
    @minLength(1) url: string;
  };
}

/** One adapter's npm package `@opensoftware/<port>-<name>` at the newest version inside its range. */
@extension("additionalProperties", Json<false>)
model FactoryLockAdapterPin {
  /** The range under `providers` that the pin was resolved from, for example "^2". */
  @minLength(1)
  range: string;

  /** The exact version, for example "2.3.1". */
  @minLength(1)
  version: string;
}
