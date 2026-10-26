// The part of a factory definition a run needs (ADR 0067, ADR 0068, ADR 0069): its name, its sandbox and forge
// adapters, and its stages in order, each with its agent, the agent's harness, prompt text and sandbox, its checks and
// its gate. Checked once against the contract and once for what only the foreman sees.
import type { FactoryDefinition, SandboxSpec } from "@opensoftware/contracts";

export interface StagePlan {
  stage: string;
  agent: string;
  harness: string;
  /** The text of the agent's prompt file. */
  prompt: string;
  gate?: { policy: string; approvers?: string[] };
  /** The checks that must succeed on the run's pull request before the stage starts. */
  checks?: string[];
  /** The sandbox the agent declares, as a spec without the run's variables; none runs the stage on the host. */
  sandbox?: SandboxSpec;
}

export interface Definition {
  factory: string;
  /** The sandbox adapter under `providers.sandbox`; "docker" when the factory names none. */
  sandboxAdapter: string;
  /** The forge adapter under `providers.forge`, which reads the checks. */
  forgeAdapter?: string;
  stages: StagePlan[];
}

/** One reason a factory cannot run: a JSON Pointer into the file and what is wrong there. */
export interface DefinitionProblem {
  path: string;
  message: string;
}

/**
 * The problems that only the foreman sees: two sandbox adapters, a stage whose agent the factory does not declare, or
 * checks without exactly one forge adapter.
 */
export function stageProblems(factory: FactoryDefinition): DefinitionProblem[] {
  const adapters = Object.keys(factory.providers?.sandbox ?? {}).length;
  const sandbox =
    adapters > 1 ? [{ path: "/providers/sandbox", message: `name one sandbox adapter, not ${adapters}` }] : [];
  return sandbox.concat(stageAgentProblems(factory), checkProblems(factory));
}

function checkProblems(factory: FactoryDefinition): DefinitionProblem[] {
  if (Object.keys(factory.providers?.forge ?? {}).length === 1) return [];
  return (factory.workflow ?? []).flatMap((stage, index) =>
    stage.checks?.length
      ? [{ path: `/workflow/${index}/checks`, message: "name one forge adapter under providers.forge" }]
      : [],
  );
}

function stageAgentProblems(factory: FactoryDefinition): DefinitionProblem[] {
  return (factory.workflow ?? []).flatMap((stage, index) => {
    const agent = agentOf(stage);
    return factory.agents[agent]
      ? []
      : [{ path: `/workflow/${index}/${stage.agent ? "agent" : "stage"}`, message: `no agent "${agent}"` }];
  });
}

/** A stage's agent defaults to the agent with the stage's name. */
export const agentOf = (stage: { stage: string; agent?: string }): string => stage.agent ?? stage.stage;

/** The definition of a checked factory, with the text of each prompt from `read`. */
export function definitionOf(factory: FactoryDefinition, read: (path: string) => string): Definition {
  const forge = Object.keys(factory.providers?.forge ?? {})[0];
  return {
    factory: factory.factory,
    sandboxAdapter: Object.keys(factory.providers?.sandbox ?? {})[0] ?? "docker",
    ...(forge ? { forgeAdapter: forge } : {}),
    stages: (factory.workflow ?? []).map((stage) => {
      const agent = agentOf(stage);
      const declared = factory.agents[agent] as FactoryDefinition["agents"][string];
      return {
        stage: stage.stage,
        agent,
        harness: declared.harness,
        prompt: read(declared.prompt),
        ...(stage.gate ? { gate: stage.gate } : {}),
        ...(stage.checks?.length ? { checks: stage.checks } : {}),
        ...(declared.sandbox ? { sandbox: { ...declared.sandbox, secrets: secretsOf(declared.secrets ?? []) } } : {}),
      };
    }),
  };
}

/** The variable of a secret reference: its name in upper case, every character outside A-Z and 0-9 as "_". */
export const secretVariable = (reference: string): string =>
  reference
    .slice(reference.indexOf("/") + 1)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_");

/** The agent's secret references by their variables, as the sandbox spec holds them (ADR 0068). */
function secretsOf(references: string[]): Record<string, string> {
  return Object.fromEntries(references.map((reference) => [secretVariable(reference), reference]));
}
