// spec-trace report: the JSON report, written to a file.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readEvidence } from "../adapters/evidence.ts";
import type { Inputs } from "../domain/model.ts";
import { report, summary } from "../domain/report.ts";
import { findings } from "./check.ts";

export function writeReport(inputs: Inputs, out: string, bundles: string[]): string {
  const evidence = bundles.length > 0 ? readEvidence(bundles) : undefined;
  const rules = inputs.results ? (["SPEC", "TRACE", "STEPS", "PASS"] as const) : (["SPEC", "TRACE", "STEPS"] as const);
  const result = report(inputs, findings(inputs, [...rules]), evidence);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  return `wrote ${out}: ${summary(result)}`;
}
