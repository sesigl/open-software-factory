// The part of a factory definition a run needs (ADR 0067, ADR 0068): its name, its sandbox adapter, and its stages in
// order, each with its agent, the agent's harness, prompt text and sandbox, and its gate. Checked once against the
// contract and once for what only the foreman sees.
import type { FactoryDefinition, SandboxSpec } from "@opensoftware/contracts";

export interface StagePlan {
  stage: string;
  agent: string;
  harness: string;
  /** The text of the agent's prompt file. */
  prompt: string;
  gate?: { policy: string; approvers?: string[] };
  /** The sandbox the agent declares, as a spec without the run's variables; none runs the stage on the host. */
  sandbox?: SandboxSpec;
}

export interface Definition {
  factory: string;
  /** The sandbox adapter under `providers.sandbox`; "docker" when the factory names none. */
  sandboxAdapter: string;
  stages: StagePlan[];
}

/** One reason a factory cannot run: a JSON Pointer into the file and what is wrong there. */
export interface DefinitionProblem {
  path: string;
  message: string;
}

/** The problems that only the foreman sees: two sandbox adapters, or a stage whose agent the factory does not declare. */
export function stageProblems(factory: FactoryDefinition): DefinitionProblem[] {
  const adapters = Object.keys(factory.providers?.sandbox ?? {}).length;
  const sandbox =
    adapters > 1 ? [{ path: "/providers/sandbox", message: `name one sandbox adapter, not ${adapters}` }] : [];
  return sandbox.concat(stageAgentProblems(factory));
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
  return {
    factory: factory.factory,
    sandboxAdapter: Object.keys(factory.providers?.sandbox ?? {})[0] ?? "docker",
    stages: (factory.workflow ?? []).map((stage) => {
      const agent = agentOf(stage);
      const declared = factory.agents[agent] as FactoryDefinition["agents"][string];
      return {
        stage: stage.stage,
        agent,
        harness: declared.harness,
        prompt: read(declared.prompt),
        ...(stage.gate ? { gate: stage.gate } : {}),
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
