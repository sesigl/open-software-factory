// spec-trace report: the JSON report, written to a file, with the changes since a base and a Markdown summary.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readEvidence } from "../adapters/evidence.ts";
import { parseFeature } from "../adapters/gherkin.ts";
import { filesAt } from "../adapters/git.ts";
import { changes } from "../domain/changes.ts";
import type { Inputs } from "../domain/model.ts";
import { outcome, report } from "../domain/report.ts";
import { markdown } from "../domain/summary.ts";
import { findings } from "./check.ts";

export interface ReportOptions {
  out: string;
  bundles: string[];
  /** A commit to compare the scenarios with. */
  base: string | undefined;
  /** A file to add the Markdown summary to. */
  summary: string | undefined;
}

export function writeReport(inputs: Inputs, root: string, options: ReportOptions): string {
  const evidence = options.bundles.length > 0 ? readEvidence(options.bundles) : undefined;
  const rules = inputs.results ? (["SPEC", "TRACE", "STEPS", "PASS"] as const) : (["SPEC", "TRACE", "STEPS"] as const);
  const changed =
    options.base === undefined
      ? null
      : changes(
          options.base,
          filesAt(root, options.base, inputs.config.features).flatMap(
            ({ file, text }) => parseFeature(file, text).scenarios,
          ),
          inputs.scenarios,
        );
  const result = report(inputs, findings(inputs, [...rules]), evidence, changed);
  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`);
  if (options.summary) {
    mkdirSync(dirname(options.summary), { recursive: true });
    appendFileSync(options.summary, markdown(result));
  }
  return `wrote ${options.out}: ${outcome(result)}`;
}
