// scorekit calibrate: judge every labeled run and compare the judge with the labels.
import { readRunFiles, readScorer, readScores, writeText } from "../adapters/files.ts";
import { calibrate as compare, type Judged, percent } from "../domain/calibration.ts";
import { UsageError } from "../domain/errors.ts";
import { parseRuns } from "../domain/runs.ts";
import { runOf } from "../domain/score.ts";
import { gatewayFrom, judgeRuns } from "./judge-runs.ts";

export interface CalibrateOptions {
  scorer?: string;
  labels?: string;
  minAgreement?: string;
  out: string;
}

export async function calibrate(paths: string[], options: CalibrateOptions, env: NodeJS.ProcessEnv) {
  const scorer = readScorer(options.scorer);
  if (!options.labels) throw new UsageError("--labels is required: a file of score records with the source ANNOTATION");
  const minimum = options.minAgreement === undefined ? undefined : Number(options.minAgreement);
  if (minimum !== undefined && !(minimum >= 0 && minimum <= 1))
    throw new UsageError("--min-agreement must be a number from 0 to 1");
  const labels = new Map(
    readScores([options.labels])
      .filter((label) => label.source === "ANNOTATION" && label.name === scorer.name)
      .map((label) => [runOf(label), Number(label.value) === 1 ? ("pass" as const) : ("fail" as const)]),
  );
  const runs = parseRuns(readRunFiles(paths));
  const gateway = gatewayFrom(env);
  const labeled = runs.filter((run) => labels.has(run.id));
  const missing = [...labels.keys()].filter((id) => !runs.some((run) => run.id === id));
  const judged: Judged[] = [];
  const errors = await judgeRuns(gateway, scorer, labeled, ({ run, verdict }) =>
    judged.push({ run: run.id, label: labels.get(run.id) as Judged["label"], verdict }),
  );
  errors.unshift(...missing.map((id) => `no run for the label of ${id}`));
  const result = compare(scorer.name, judged, missing);
  writeText(options.out, `${JSON.stringify(result, null, 2)}\n`);
  const agreement = `agreement ${result.agreed} of ${result.labeled} (${percent(result.agreement)})`;
  const below = minimum !== undefined && result.agreement < minimum;
  const kappa = result.kappa === null ? "" : `, kappa ${result.kappa.toFixed(2)}`;
  return {
    lines: [below ? `${agreement} is below ${percent(minimum)}` : `${agreement}${kappa}`],
    errors,
    failed: below || errors.length > missing.length,
  };
}
