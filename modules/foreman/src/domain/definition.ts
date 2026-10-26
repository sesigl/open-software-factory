// The part of a factory definition a run needs (ADR 0067): its name and its stages in order, each with its agent, the
// agent's harness and prompt text, and its gate. Checked once against the contract and once for the agents' names.
import type { FactoryDefinition } from "@opensoftware/contracts";

export interface StagePlan {
  stage: string;
  agent: string;
  harness: string;
  /** The text of the agent's prompt file. */
  prompt: string;
  gate?: { policy: string; approvers?: string[] };
}

export interface Definition {
  factory: string;
  stages: StagePlan[];
}

/** One reason a factory cannot run: a JSON Pointer into the file and what is wrong there. */
export interface DefinitionProblem {
  path: string;
  message: string;
}

/** The problems that only the foreman sees: a stage whose agent the factory does not declare. */
export function stageProblems(factory: FactoryDefinition): DefinitionProblem[] {
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
    stages: (factory.workflow ?? []).map((stage) => {
      const agent = agentOf(stage);
      const declared = factory.agents[agent] as FactoryDefinition["agents"][string];
      return {
        stage: stage.stage,
        agent,
        harness: declared.harness,
        prompt: read(declared.prompt),
        ...(stage.gate ? { gate: stage.gate } : {}),
      };
    }),
  };
}
