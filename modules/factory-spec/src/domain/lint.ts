// The lint rules: the factory-definition contract, then the rules a schema cannot express (ADR 0020).
import { type FactoryDefinition, validate } from "@opensoftware/contracts";
import { LineCounter, parseDocument } from "yaml";
import { locate, type Place, segments } from "./locate.ts";

export interface Problem extends Place {
  message: string;
}

export interface Linted {
  /** Only when there is no problem. */
  definition?: FactoryDefinition;
  problems: Problem[];
}

/** Lints the text of factory.yaml; `exists` says whether a path relative to the file exists. */
export function lint(text: string, exists: (path: string) => boolean): Linted {
  const lines = new LineCounter();
  const document = parseDocument(text, { lineCounter: lines, prettyErrors: false });
  if (document.errors.length > 0) {
    return {
      problems: document.errors.map((error) => ({ ...place(lines, error.pos[0]), message: firstLine(error.message) })),
    };
  }
  const data = document.toJS() as unknown;
  const at = (path: string[], message: string): Problem => ({ ...locate(document, lines, path), message });
  const schema = validate("factory-definition", data);
  if (schema.length > 0)
    return { problems: schema.map((problem) => at(segments(problem.path), `${problem.path}: ${problem.message}`)) };
  const definition = data as FactoryDefinition;
  const problems = rules(definition, exists)
    .map(([path, message]) => at(path, message))
    .sort((a, b) => a.line - b.line || a.column - b.column);
  return problems.length > 0 ? { problems } : { definition, problems };
}

type Finding = [path: string[], message: string];

function rules(definition: FactoryDefinition, exists: (path: string) => boolean): Finding[] {
  const findings: Finding[] = [];
  const declared = (port: keyof NonNullable<FactoryDefinition["providers"]>): string[] =>
    Object.keys(definition.providers?.[port] ?? {});
  const files: Finding[] = [];
  for (const [name, agent] of Object.entries(definition.agents)) {
    if (!declared("harness").includes(agent.harness)) {
      findings.push([
        ["agents", name, "harness"],
        `harness "${agent.harness}" is not declared under providers.harness`,
      ]);
    }
    (agent.secrets ?? []).forEach((secret, index) => {
      const provider = secret.slice("ref:".length, secret.indexOf("/"));
      if (declared("secrets").includes(provider)) return;
      const message = `secret "${secret}" uses the provider "${provider}", which providers.secrets does not declare`;
      findings.push([["agents", name, "secrets", String(index)], message]);
    });
    files.push([["agents", name, "prompt"], agent.prompt]);
    (agent.skills ?? []).forEach((skill, index) => {
      files.push([["agents", name, "skills", String(index)], skill]);
    });
  }
  (definition.workflow ?? []).forEach((stage, index) => {
    const agent = stage.agent ?? stage.stage;
    if (!Object.hasOwn(definition.agents, agent)) {
      findings.push([
        ["workflow", String(index), "stage"],
        `stage "${stage.stage}" runs the agent "${agent}", which agents does not declare`,
      ]);
    }
    if (stage.gate) files.push([["workflow", String(index), "gate", "policy"], stage.gate.policy]);
  });
  for (const [name, scorer] of Object.entries(definition.scorers ?? {}))
    files.push([["scorers", name, "judge"], scorer.judge]);
  for (const [name, suite] of Object.entries(definition.benchmarks ?? {}))
    files.push([["benchmarks", name, "suite"], suite.suite]);
  for (const [path, file] of files) if (!exists(file)) findings.push([path, `the file "${file}" does not exist`]);
  return findings;
}

function place(lines: LineCounter, offset: number): Place {
  const { line, col } = lines.linePos(offset);
  return { line, column: col };
}

function firstLine(message: string): string {
  return message.split("\n")[0] as string;
}
