// Reads a JUnit XML report. A test case names its scenario in the property "scenario" or in its name.
import { readFileSync } from "node:fs";
import { parseJUnit } from "@opensoftware/spec-files";
import { type Report, scenarioIds, type Test } from "../domain/evidence.ts";

export function junitReport(file: string): Report {
  const tests = parseJUnit(readFileSync(file, "utf8")).map(
    (test): Test => ({
      title: test.name,
      ids: scenarioIds(test.properties.scenario ?? test.name),
      result: test.status,
      attachments: [],
    }),
  );
  return { source: file, tests };
}
