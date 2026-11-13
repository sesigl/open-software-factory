// The part of a factory definition a run needs (ADR 0067 to ADR 0070, ADR 0078): its name, its sandbox, forge and
// inference adapters, and its stages in order, each with its agent, the agent's harness, model, effort, prompt text and
// sandbox, its checks and its gate. Checked once against the contract and once for what only the foreman sees.
import type { FactoryDefinition, SandboxSpec } from "@opensoftware/contracts";

/** The agent of a stage that runs one; a stage that only waits has none (ADR 0107). */
export interface AgentPlan {
  agent: string;
  harness: string;
  /** The agent's model: a model ID or a routing alias of the inference gateway. */
  model: string;
  /** The agent's effort level, which each harness adapter reads as OSF_EFFORT (ADR 0078). */
  effort: FactoryDefinition["agents"][string]["effort"];
  /** The text of the agent's prompt file. */
  prompt: string;
  /** The sandbox the agent declares, as a spec without the run's variables; none runs the stage on the host. */
  sandbox?: SandboxSpec;
}

export type StagePlan = {
  stage: string;
  gate?: { policy: string; approvers?: string[] };
  /** The checks that must succeed on the run's pull request before the stage starts. */
  checks?: string[];
} & (AgentPlan | { agent?: undefined; wait: true });

export interface Definition {
  factory: string;
  /** The sandbox adapter under `providers.sandbox`; none, and the foreman's FOREMAN_SANDBOX picks it (ADR 0096). */
  sandboxAdapter?: string;
  /** The forge adapter under `providers.forge`, which reads the checks. */
  forgeAdapter?: string;
  /** The inference adapter under `providers.inference`, its config as `factory.yaml` names it, and a run's budget. */
  inference?: { adapter: string; config: string; budget?: number };
  stages: StagePlan[];
}

/** One reason a factory cannot run: a JSON Pointer into the file and what is wrong there. */
export interface DefinitionProblem {
  path: string;
  message: string;
}

/**
 * The problems that only the foreman sees: two sandbox or inference adapters, a stage whose agent the factory does not
 * declare, checks without exactly one forge adapter, or an inference adapter without its config.
 */
export function stageProblems(factory: FactoryDefinition): DefinitionProblem[] {
  return oneAdapter(factory, "sandbox").concat(
    oneAdapter(factory, "inference"),
    stageAgentProblems(factory),
    checkProblems(factory),
    inferenceProblems(factory),
  );
}

function oneAdapter(factory: FactoryDefinition, port: "sandbox" | "inference"): DefinitionProblem[] {
  const adapters = Object.keys(factory.providers?.[port] ?? {}).length;
  return adapters > 1 ? [{ path: `/providers/${port}`, message: `name one ${port} adapter, not ${adapters}` }] : [];
}

function inferenceProblems(factory: FactoryDefinition): DefinitionProblem[] {
  const named = Object.keys(factory.providers?.inference ?? {}).length > 0;
  if (named && !factory.inference)
    return [{ path: "/inference", message: "give the inference adapter's config as inference.config" }];
  if (!named && factory.inference)
    return [{ path: "/inference", message: "name one inference adapter under providers.inference" }];
  return [];
}

function checkProblems(factory: FactoryDefinition): DefinitionProblem[] {
  if (Object.keys(factory.providers?.forge ?? {}).length === 1) return [];
  return (factory.workflow ?? []).flatMap((stage, index) => [
    ...(stage.checks?.length
      ? [{ path: `/workflow/${index}/checks`, message: "name one forge adapter under providers.forge" }]
      : []),
    ...(stage.evidence === "required"
      ? [
          {
            path: `/workflow/${index}/evidence`,
            message: `name one forge adapter under providers.forge: the stage waits for the check "${EVIDENCE_CHECK}"`,
          },
        ]
      : []),
  ]);
}

/** The check that says a pull request has its evidence bundle: proof's commit status (ADR 0088). */
export const EVIDENCE_CHECK = "proof";

/** The checks a stage waits for: its own, and proof's when it must produce evidence. */
const checksOf = (stage: NonNullable<FactoryDefinition["workflow"]>[number]): string[] => [
  ...new Set([...(stage.checks ?? []), ...(stage.evidence === "required" ? [EVIDENCE_CHECK] : [])]),
];

function stageAgentProblems(factory: FactoryDefinition): DefinitionProblem[] {
  return (factory.workflow ?? []).flatMap((stage, index) => {
    if (stage.wait) return waitProblems(stage, index);
    const agent = agentOf(stage);
    return factory.agents[agent]
      ? []
      : [{ path: `/workflow/${index}/${stage.agent ? "agent" : "stage"}`, message: `no agent "${agent}"` }];
  });
}

/** A stage that only waits names no agent and something to wait for (ADR 0107). */
function waitProblems(stage: NonNullable<FactoryDefinition["workflow"]>[number], index: number): DefinitionProblem[] {
  const waits = Boolean(stage.checks?.length || stage.gate || stage.evidence === "required");
  return [
    ...(stage.agent ? [{ path: `/workflow/${index}/agent`, message: "a stage that only waits names no agent" }] : []),
    ...(waits
      ? []
      : [
          {
            path: `/workflow/${index}/wait`,
            message: 'a stage that only waits names checks, the evidence "required" or a gate',
          },
        ]),
  ];
}

/** A stage's agent defaults to the agent with the stage's name. */
export const agentOf = (stage: { stage: string; agent?: string }): string => stage.agent ?? stage.stage;

/** The definition of a checked factory, with the text of each prompt from `read`. */
export function definitionOf(factory: FactoryDefinition, read: (path: string) => string): Definition {
  const forge = Object.keys(factory.providers?.forge ?? {})[0];
  const inference = Object.keys(factory.providers?.inference ?? {})[0];
  return {
    factory: factory.factory,
    sandboxAdapter: Object.keys(factory.providers?.sandbox ?? {})[0],
    ...(forge ? { forgeAdapter: forge } : {}),
    ...(inference && factory.inference ? { inference: { adapter: inference, ...factory.inference } } : {}),
    stages: (factory.workflow ?? []).map((stage): StagePlan => {
      const waits = {
        stage: stage.stage,
        ...(stage.gate ? { gate: stage.gate } : {}),
        ...(checksOf(stage).length ? { checks: checksOf(stage) } : {}),
      };
      if (stage.wait) return { ...waits, wait: true };
      const agent = agentOf(stage);
      const declared = factory.agents[agent] as FactoryDefinition["agents"][string];
      return {
        ...waits,
        agent,
        harness: declared.harness,
        model: declared.model,
        effort: declared.effort,
        prompt: read(declared.prompt),
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
