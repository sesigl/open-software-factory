// Harbor trial results → cells of configuration and model, with correctness, average cost per trial and
// incomplete scoring, and the best, lowest-cost and most efficient cell and the Pareto front (ADR 0042).

export interface Trial {
  /** The name of the trial's job folder. */
  configuration: string;
  /** The job folder as the user named it, for `harbor job resume`. */
  jobPath: string;
  task: string;
  model: string;
  /** The verifier's `reward`, or null when the trial was not scored. */
  reward: number | null;
  costUsd: number | null;
  /** The exception type of a trial that ended in an error. */
  error: string | null;
}

interface TrialJson {
  task_name?: unknown;
  trial_name?: unknown;
  agent_info?: { name?: string; model_info?: { name?: string; provider?: string | null } | null };
  verifier_result?: { rewards?: Record<string, unknown> | null } | null;
  agent_result?: { cost_usd?: number | null } | null;
  exception_info?: { exception_type?: string } | null;
}

/** A trial from a Harbor result.json, or null for a file that is not a trial result (a job's result.json). */
export function trialOf(json: TrialJson, configuration: string, jobPath: string): Trial | null {
  if (typeof json.task_name !== "string" || typeof json.trial_name !== "string") return null;
  const info = json.agent_info?.model_info;
  const reward = json.verifier_result?.rewards?.reward;
  return {
    configuration,
    jobPath,
    task: json.task_name,
    model: info?.name
      ? info.provider
        ? `${info.provider}/${info.name}`
        : info.name
      : (json.agent_info?.name ?? "unknown"),
    reward: typeof reward === "number" ? reward : null,
    costUsd: typeof json.agent_result?.cost_usd === "number" ? json.agent_result.cost_usd : null,
    error: json.exception_info?.exception_type ?? null,
  };
}

export interface Cell {
  configuration: string;
  model: string;
  trials: number;
  /** Tasks with at least one scored trial, of `tasks`. */
  scoredTasks: number;
  tasks: number;
  /** The mean reward of the scored trials, 0 to 1. */
  correctness: number | null;
  costUsdPerTrial: number | null;
  trialsWithoutCost: number;
  incomplete: boolean;
  missingTasks: string[];
  /** The command that reruns the missing tasks, when the cell is incomplete. */
  resume: string | null;
}

export type CellRef = Pick<Cell, "configuration" | "model">;

export interface Report {
  tasks: string[];
  cells: Cell[];
  best: CellRef | null;
  lowestCost: CellRef | null;
  mostEfficient: CellRef | null;
  /** The cells no other cell beats on both correctness and cost, cheapest first. */
  paretoFront: CellRef[];
}

const round = (value: number): number => Math.round(value * 10_000) / 10_000;
const mean = (values: number[]): number | null =>
  values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const ref = (cell: Cell): CellRef => ({ configuration: cell.configuration, model: cell.model });

export const cellName = (cell: CellRef): string => `${cell.configuration} · ${cell.model}`;

export function report(trials: Trial[]): Report {
  const tasks = [...new Set(trials.map((trial) => trial.task))].sort();
  const groups = new Map<string, Trial[]>();
  for (const trial of trials) {
    const key = JSON.stringify([trial.configuration, trial.model]);
    groups.set(key, [...(groups.get(key) ?? []), trial]);
  }
  const cells = [...groups.values()].map((group) => cell(group, tasks));
  cells.sort((a, b) => cellName(a).localeCompare(cellName(b)));

  const priced = cells.filter(
    (c): c is Cell & { correctness: number; costUsdPerTrial: number } =>
      c.correctness !== null && c.costUsdPerTrial !== null,
  );
  const top = <T>(list: T[], better: (a: T, b: T) => boolean): T | null =>
    list.reduce<T | null>((found, item) => (found === null || better(item, found) ? item : found), null);
  const best = top(
    priced,
    (a, b) =>
      a.correctness > b.correctness || (a.correctness === b.correctness && a.costUsdPerTrial < b.costUsdPerTrial),
  );
  const lowestCost = top(
    priced,
    (a, b) =>
      a.costUsdPerTrial < b.costUsdPerTrial ||
      (a.costUsdPerTrial === b.costUsdPerTrial && a.correctness > b.correctness),
  );
  const efficiency = (c: (typeof priced)[number]) => c.correctness / c.costUsdPerTrial;
  const mostEfficient = top(
    priced,
    (a, b) => efficiency(a) > efficiency(b) || (efficiency(a) === efficiency(b) && a.correctness > b.correctness),
  );
  const beaten = (c: (typeof priced)[number]) =>
    priced.some(
      (d) =>
        d.costUsdPerTrial <= c.costUsdPerTrial &&
        d.correctness >= c.correctness &&
        (d.costUsdPerTrial < c.costUsdPerTrial || d.correctness > c.correctness),
    );
  const paretoFront = priced
    .filter((c) => !beaten(c))
    .sort((a, b) => a.costUsdPerTrial - b.costUsdPerTrial)
    .map(ref);
  return {
    tasks,
    cells,
    best: best && ref(best),
    lowestCost: lowestCost && ref(lowestCost),
    mostEfficient: mostEfficient && ref(mostEfficient),
    paretoFront,
  };
}

function cell(group: Trial[], tasks: string[]): Cell {
  const first = group[0] as Trial;
  const scored = group.filter((trial) => trial.reward !== null);
  const scoredTasks = new Set(scored.map((trial) => trial.task));
  const missingTasks = tasks.filter((task) => !scoredTasks.has(task));
  const costs = group.flatMap((trial) => (trial.costUsd === null ? [] : [trial.costUsd]));
  const errors = [...new Set(group.flatMap((trial) => (trial.reward === null && trial.error ? [trial.error] : [])))];
  return {
    configuration: first.configuration,
    model: first.model,
    trials: group.length,
    scoredTasks: scoredTasks.size,
    tasks: tasks.length,
    correctness: mean(scored.map((trial) => trial.reward as number)),
    costUsdPerTrial: mean(costs),
    trialsWithoutCost: group.length - costs.length,
    incomplete: missingTasks.length > 0,
    missingTasks,
    resume: missingTasks.length
      ? [
          "harbor job resume --job-path",
          first.jobPath,
          ...errors.sort().map((error) => `--filter-error-type ${error}`),
        ].join(" ")
      : null,
  };
}
