// Test reports and bundles that many scenarios share.
import type { Sut } from "@opensoftware/testkit";

export interface PlaywrightTest {
  title: string;
  status?: "expected" | "unexpected" | "flaky" | "skipped";
  tags?: string[];
  annotations?: { type: string; description?: string }[];
  attachments?: { name: string; contentType: string; path: string }[];
}

/** A Playwright JSON report with one spec file that holds the tests. */
export function playwrightReport(tests: PlaywrightTest[]): string {
  return JSON.stringify({
    suites: [
      {
        title: "web.spec.ts",
        specs: tests.map((test) => ({
          title: test.title,
          tags: test.tags ?? [],
          tests: [
            {
              status: test.status ?? "expected",
              annotations: test.annotations ?? [],
              results: [{ status: "passed", attachments: test.attachments ?? [] }],
            },
          ],
        })),
      },
    ],
  });
}

export const screenshot = (file: string) => ({
  name: "screenshot",
  contentType: "image/png",
  path: `test-results/${file}`,
});

/** $INPUT/report.json with the tests, and a file for each of their attachments. */
export async function putPlaywright(sut: Sut, tests: PlaywrightTest[]): Promise<void> {
  await sut.files.put("$INPUT/report.json", playwrightReport(tests));
  for (const test of tests) {
    for (const attachment of test.attachments ?? []) {
      await sut.files.put(`$INPUT/${attachment.path}`, `${attachment.name} of ${test.title}`);
    }
  }
}

export interface JunitCase {
  name: string;
  scenario?: string;
  result?: "failure" | "skipped";
}

/** A JUnit XML report with one suite that holds the test cases. */
export function junitReport(cases: JunitCase[]): string {
  const testcases = cases.map((entry) => {
    const properties = entry.scenario
      ? `<properties><property name="scenario" value="${entry.scenario}"/></properties>`
      : "";
    const result =
      entry.result === "failure" ? '<failure message="expected 1, got 2"/>' : entry.result ? "<skipped/>" : "";
    return `<testcase classname="system-tests/x.test.ts" name="${entry.name}" time="0.1">${properties}${result}</testcase>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="system-tests" tests="${cases.length}">${testcases.join("")}</testsuite></testsuites>\n`;
}

/** The manifest of the bundle in a folder below $INPUT or $OUTPUT. */
export async function manifestOf(sut: Sut, folder = "$OUTPUT/evidence"): Promise<Manifest> {
  return JSON.parse(await sut.files.read(`${folder}/evidence.json`)) as Manifest;
}

export interface Manifest {
  id: string;
  createdAt: string;
  result: string;
  subject: { repository: string; commit: string; pullRequest?: string };
  producer: { name: string; version: string };
  scenarios: { id: string; result: string; artifacts: string[] }[];
  artifacts: { path: string; kind: string; mediaType: string; sha256: string; bytes?: number }[];
}

/**
 * $INPUT is a Git repository with one commit and the bundle $INPUT/evidence of these tests, for the commit and the
 * pull request given (or HEAD and none).
 */
export async function bundleOf(
  sut: Sut,
  tests: PlaywrightTest[],
  subject: { commit?: string; pullRequest?: string } = {},
): Promise<void> {
  await putPlaywright(sut, tests);
  await sut.git.commit("init");
  const args = [
    "bundle",
    "--playwright",
    "report.json",
    "--out",
    "evidence",
    "--repository",
    "https://github.com/acme/web",
  ];
  if (subject.commit) args.push("--commit", subject.commit);
  if (subject.pullRequest) args.push("--pull-request", subject.pullRequest);
  const run = await sut.cli(args);
  if (run.exitCode !== 0) throw new Error(`proof bundle failed: ${run.stderr}`);
}

export const SHA = "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c";
export const PR = "https://github.com/acme/web/pull/7";
