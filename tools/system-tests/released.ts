// The deploy feature files and JUnit reports of the osf released-images scenarios.
import type { scenario } from "@opensoftware/testkit";

type Sut = Parameters<Parameters<typeof scenario>[1]>[0]["sut"];

export const RUN = "https://github.com/acme/factory/actions/runs/7";
export const REF = "1a2b3c4";

/** A feature file of deploy with one plain scenario per entry: its ID and its tags after the ID. */
export async function deployFeature(sut: Sut, name: string, scenarios: [string, string][]): Promise<void> {
  const blocks = scenarios.map(
    ([id, tags]) =>
      `  @id=${id} ${tags}\n  Scenario: the scenario ${id}\n    Given the profile\n    When it starts\n    Then it runs\n`,
  );
  await sut.files.put(`$INPUT/deploy/features/${name}`, `@module=deploy\nFeature: ${name}\n\n${blocks.join("\n")}`);
}

/** A JUnit report as Vitest writes it, one test case per scenario with its outcome. */
export async function junitReport(
  sut: Sut,
  path: string,
  cases: [string, "passed" | "failed" | "skipped"][],
): Promise<void> {
  const body = cases.map(([id, outcome]) => {
    const inner =
      outcome === "failed"
        ? `<failure message="expected 1 to be 0" type="AssertionError">AssertionError</failure>`
        : outcome === "skipped"
          ? "<skipped/>"
          : "";
    return `    <testcase classname="system-tests/${id}.test.ts" name="${id}" time="1.5">${inner}</testcase>`;
  });
  await sut.files.put(
    `$INPUT/${path}`,
    [
      '<?xml version="1.0" encoding="UTF-8" ?>',
      `<testsuites name="vitest tests" tests="${cases.length}">`,
      `  <testsuite name="system-tests" tests="${cases.length}">`,
      ...body,
      "  </testsuite>",
      "</testsuites>",
      "",
    ].join("\n"),
  );
}

/** `osf released-images report` on a report, with the run and the commit of the scenarios. */
export const report = (sut: Sut, path: string) =>
  sut.cli(["released-images", "report", path, "--run", RUN, "--ref", REF]);
