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

  /**
   * The skills of other Git repositories that `factory plan` pinned, by the skill's name (ADR 0146). A pin counts only
   * while its `source` is the entry factory.yaml declares; the foreman and `factory render` fetch its commit and check
   * its hash.
   */
  skills?: Record<FactoryLockSkillPin>;
}

/** One skill of another Git repository at the commit its ref had when `factory plan` pinned it. */
@extension("additionalProperties", Json<false>)
model FactoryLockSkillPin {
  /** The entry of `skills` in factory.yaml that the pin was resolved from, `git+<url>#<ref>:<path>`. */
  @pattern("^git\\+.+#[^:]+:.+$")
  source: string;

  /** The full commit, 40 hexadecimal characters, or 64 in a repository of SHA-256. */
  @pattern("^([0-9a-f]{40}|[0-9a-f]{64})$")
  commit: string;

  /** The hash of the skill folder's files in the form of Go's modules: "h1:" and the base64 of a SHA-256. */
  @pattern("^h1:[A-Za-z0-9+/]{43}=$")
  hash: string;
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
