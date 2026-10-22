// taskcapture run (ADR 0045): the configurations of the matrix and the arguments of one `harbor run` per
// configuration; and the run a run record describes, for capture --run.
import { check, UsageError } from "@opensoftware/cli";
import type { RunSpan } from "@opensoftware/contracts";

export interface Configuration {
  /** The job name, so the job folder names the configuration in the report. */
  name: string;
  /** A Harbor job config file for this configuration. */
  file: string | undefined;
}

export const DEFAULT_CONFIGURATION: Configuration = { name: "default", file: undefined };

/** `v1` or `v1=harbor.yaml`. */
export function configurationOf(spec: string): Configuration {
  const [, name, file] = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:=(.+))?$/.exec(spec) ?? [];
  check(name, "--configuration takes a name like v1, or v1=harbor.yaml with a Harbor config file");
  return { name, file };
}

export interface Matrix {
  suite: string;
  jobs: string;
  agent: string;
  models: string[];
  allowHosts: string[];
}

/** The arguments of `harbor run` for one configuration. */
export function harborArgs(matrix: Matrix, configuration: Configuration): string[] {
  return [
    "run",
    "--path",
    matrix.suite,
    "--agent",
    matrix.agent,
    ...matrix.models.flatMap((model) => ["--model", model]),
    "--job-name",
    configuration.name,
    "--jobs-dir",
    matrix.jobs,
    ...(configuration.file ? ["--config", configuration.file] : []),
    ...matrix.allowHosts.flatMap((host) => ["--allow-agent-host", host]),
    "--yes",
    "--quiet",
  ];
}

/** The run a task was captured from: kept in the task's [metadata]. */
export interface SourceRun {
  id: string;
  harness: string | undefined;
  model: string | undefined;
  costUsd: number | undefined;
  pulls: string[];
}

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** The run of a run record's spans; null when no span is the run's `invoke_agent` span. */
export function sourceRunOf(spans: RunSpan[] | undefined): SourceRun | null {
  const span = spans?.find((candidate) => candidate.name === "invoke_agent");
  const id = text(span?.resource["osf.run.id"]);
  if (!span || !id) return null;
  const { attributes } = span;
  const urls = attributes["osf.pull_request.urls"];
  const cost = attributes["osf.cost.usd"];
  return {
    id,
    harness: text(span.resource["osf.harness.name"]),
    model: text(attributes["gen_ai.response.model"]) ?? text(attributes["gen_ai.request.model"]),
    costUsd: typeof cost === "number" ? cost : undefined,
    pulls: Array.isArray(urls) ? urls.filter((url): url is string => typeof url === "string") : [],
  };
}

/** The pull request to capture: `url` when the run names it, else the run's only pull request. */
export function pullOfRun(run: SourceRun, url: string | undefined): string {
  if (url) {
    if (!run.pulls.includes(url)) throw new UsageError(`the run ${run.id} names no pull request ${url}`);
    return url;
  }
  if (run.pulls.length === 0) throw new UsageError(`the run ${run.id} names no pull request`);
  if (run.pulls.length > 1)
    throw new UsageError(
      `the run ${run.id} names ${run.pulls.length} pull requests; name one: ${run.pulls.join(", ")}`,
    );
  return run.pulls[0] as string;
}
