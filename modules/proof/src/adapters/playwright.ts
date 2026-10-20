// Reads Playwright's JSON report (reporter "json"): suites with specs, specs with tests, tests with results.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { kindOf, type Result, scenarioIds, type Test } from "../domain/evidence.ts";

interface Suite {
  title?: string;
  suites?: Suite[];
  specs?: Spec[];
}

interface Spec {
  title: string;
  tags?: string[];
  tests?: {
    status: string;
    annotations?: { type: string; description?: string }[];
    results?: { attachments?: { name: string; contentType: string; path?: string }[] }[];
  }[];
}

const RESULTS: Record<string, Result> = {
  expected: "passed",
  unexpected: "failed",
  flaky: "failed",
  skipped: "skipped",
};

/** Every test of the report. Attachment paths are resolved against the report's folder. */
export function playwrightTests(file: string): Test[] {
  const report = JSON.parse(readFileSync(file, "utf8")) as Suite;
  const folder = dirname(resolve(file));
  const tests: Test[] = [];
  const walk = (suite: Suite, titles: string[]): void => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const notes = (test.annotations ?? []).map((note) => `${note.type} ${note.description ?? ""}`);
        tests.push({
          title: spec.title,
          ids: scenarioIds(...titles, spec.title, ...(spec.tags ?? []), ...notes),
          result: RESULTS[test.status] ?? "failed",
          attachments: (test.results ?? [])
            .flatMap((result) => result.attachments ?? [])
            .filter((attachment) => attachment.path !== undefined)
            .map((attachment) => ({
              source: resolve(folder, attachment.path as string),
              kind: kindOf(attachment.name, attachment.contentType),
              mediaType: attachment.contentType,
            })),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title ?? ""]);
  };
  walk(report, []);
  return tests;
}
