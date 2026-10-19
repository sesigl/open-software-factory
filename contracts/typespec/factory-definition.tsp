import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

// Every object in the factory definition is closed: people write it by hand, so an unknown field is a typo
// and is rejected with its path.

/**
 * `factory.yaml`: the desired state of one factory (P3). Paths are relative to the file.
 * Realizes SCN-FACTORY-CODE-001: agents and prompts; MCP servers, skills and secrets per agent;
 * repositories; model and runtime; automations; scorers and benchmarks.
 */
@extension("additionalProperties", Json<false>)
model FactoryDefinition {
  /** Editors may point at this schema. Ignored by every tool. */
  `$schema`?: string;

  /** Version of this format. A new major version of the format gets a new value. */
  version: FormatVersion;

  /** Name of the factory. */
  factory: Name;

  description?: string;

  /** Adapters per port with a version range, pinned in `factory.lock` by `factory plan`. */
  providers?: Providers;

  /** Agents by name. */
  @minProperties(1)
  agents: Record<Agent>;

  /** Stages in order. Each stage runs one agent; the agent defaults to the stage name. */
  workflow?: Stage[];

  /** What starts work without a person asking. */
  automations?: Automation[];

  /** Scorers by name. */
  scorers?: Record<Scorer>;

  /** Benchmark suites by name. */
  benchmarks?: Record<Benchmark>;
}

/** A semver range of an adapter, for example "^2". */
@minLength(1)
scalar VersionRange extends string;

/** The adapters a factory uses, per port (docs/architecture/internals.md). Keys are adapter names. */
@extension("additionalProperties", Json<false>)
model Providers {
  harness?: Record<VersionRange>;
  sandbox?: Record<VersionRange>;
  channel?: Record<VersionRange>;
  tracker?: Record<VersionRange>;
  forge?: Record<VersionRange>;
  inference?: Record<VersionRange>;
  secrets?: Record<VersionRange>;
  telemetry?: Record<VersionRange>;
  policy?: Record<VersionRange>;
}

/** A reference to a secret, resolved at the egress proxy, never in the sandbox: "ref:<provider>/<name>". */
@pattern("^ref:[a-z][a-z0-9-]*/[A-Za-z0-9_./-]+$")
scalar SecretReference extends string;

@extension("additionalProperties", Json<false>)
model Agent {
  description?: string;

  /** Harness adapter, declared under `providers.harness`, for example "claude-code". */
  harness: Name;

  /** A model ID or a routing alias of the inference gateway, for example "routes/triage". */
  @minLength(1)
  `model`: string;

  /** Path to the Markdown prompt. */
  @minLength(1)
  prompt: string;

  /** Repositories the agent operates on, as clone URLs or "<owner>/<name>". */
  repositories?: string[];

  /** MCP servers: `registry:<name>@<version>` or `<name>@<version>`. */
  mcp?: string[];

  /** Paths to skill folders. */
  skills?: string[];

  secrets?: SecretReference[];

  /** Runtime of the agent. */
  sandbox?: Sandbox;
}

@extension("additionalProperties", Json<false>)
model Sandbox {
  /** Sandbox template name, for example "node-24". */
  @minLength(1)
  template: string;

  /** CPU cores. The smallest unit is 0.001 (one millicore). */
  @minValue(0.001)
  cpu?: float64;

  /** Kubernetes quantity, for example "8Gi". */
  @pattern("^[0-9]+(Ki|Mi|Gi|Ti)?$")
  memory?: string;

  /** Hostnames the sandbox may reach. Everything else is blocked. */
  egress?: string[];
}

@extension("additionalProperties", Json<false>)
model Stage {
  stage: Name;

  /** Agent that runs the stage. Defaults to the agent with the stage's name. */
  agent?: Name;

  /** The stage waits for a decision before it starts. */
  gate?: Gate;

  /** Whether the stage must produce an evidence bundle. */
  evidence?: EvidenceRequirement;
}

enum EvidenceRequirement {
  required,
  optional,
}

@extension("additionalProperties", Json<false>)
model Gate {
  /** Path to the Rego policy that decides or picks the approvers. */
  @minLength(1)
  policy: string;

  /** Approver groups. The policy may narrow them. */
  approvers?: Name[];
}

/**
 * Starts the workflow, or the named job, on an event (`on`) or a schedule (`cron`). Exactly one of the two; a
 * schedule names its job. One model rather than a union, so every generated client reads it without guessing.
 */
@extension("additionalProperties", Json<false>)
@extension(
  "oneOf",
  #[
    #{ required: #["on"], not: #{ required: #["cron"] } },
    #{ required: #["cron", "run"], not: #{ required: #["on"] } }
  ]
)
model Automation {
  /** Event filter, for example "github.issue.labeled(auto-implement)" or "sentry.fatal". */
  @minLength(1)
  on?: string;

  /** Five-field cron expression in UTC. */
  @minLength(1)
  cron?: string;

  /** Job to run. Required with `cron`; without it an event starts the workflow. */
  run?: Name;
}

@extension("additionalProperties", Json<false>)
model Scorer {
  /** Path to the Markdown judge prompt. */
  @minLength(1)
  judge: string;

  /** Share of runs to score, 0 to 1. Default 1. */
  @minValue(0)
  @maxValue(1)
  sample?: float64;
}

@extension("additionalProperties", Json<false>)
model Benchmark {
  /** Path to the Harbor task suite. */
  @minLength(1)
  suite: string;

  /** Five-field cron expression in UTC. Without it the suite runs on request. */
  schedule?: string;
}
