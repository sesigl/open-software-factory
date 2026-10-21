// Sample repositories that many scenarios share: a feature file with scenarios, their tests and JUnit reports.
import type { Sut } from "@opensoftware/testkit";

export const STEPS = ["Given a cart with one book", "When the guest pays with a card", "Then the order is paid"];

/** The lines of one scenario: its tags, its title and its steps. */
export function block(tags: string, steps = STEPS, title = "Scenario: A guest pays with a card"): string[] {
  return [`  ${tags}`, `  ${title}`, ...steps.map((step) => `    ${step}`)];
}

/** A feature file: the title on line 1, the first scenario's tags on line 3 and its title on line 4. */
export function feature(...blocks: string[][]): string {
  return `Feature: Checkout\n\n${blocks.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}

/** The labels of a test, one `[function, label]` per step. */
export const LABELS: [string, string][] = [
  ["given", "a cart with one book"],
  ["when", "the guest pays with a card"],
  ["then", "the order is paid"],
];

/** A test file whose scenario call is on line 3 and whose steps follow on lines 4 to 6. */
export function test(id: string, labels = LABELS, call = "scenario"): string {
  return [
    'import { scenario } from "@opensoftware/testkit";',
    "",
    `${call}(${JSON.stringify(id)}, async ({ given, when, then }) => {`,
    ...labels.map(([step, label]) => `  await ${step}(${JSON.stringify(label)}, async () => {});`),
    "});",
    "",
  ].join("\n");
}

/** A JUnit report with one test case per entry; `id` becomes the property `scenario`. */
export function junit(cases: { id?: string; name?: string; body?: string }[]): string {
  const rows = cases.map(({ id, name = "a guest pays", body = "" }) => {
    const property = id ? `<properties><property name="scenario" value="${id}"/></properties>` : "";
    return `    <testcase classname="tests/checkout.test.ts" name="${name}" time="0.1">${property}${body}</testcase>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<testsuites>",
    '  <testsuite name="tests/checkout.test.ts">',
    ...rows,
    "  </testsuite>",
    "</testsuites>",
    "",
  ].join("\n");
}

export async function put(sut: Sut, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) await sut.files.put(`$INPUT/${path}`, content);
}

/** The scenario SCN-SHOP-001 in features/checkout.feature and its test in tests/SCN-SHOP-001.test.ts. */
export async function traced(sut: Sut, status = "implemented"): Promise<void> {
  await put(sut, {
    "features/checkout.feature": feature(block(`@id=SCN-SHOP-001 @status=${status}`)),
    "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
  });
}

export interface Report {
  scenarios: {
    id: string;
    status: string;
    examples: number;
    tests: string[];
    result: string | null;
    evidence: number | null;
  }[];
  totals: Record<string, number>;
  findings: { rule: string; file: string; line: number; message: string }[];
  changes: {
    base: string;
    added: string[];
    removed: string[];
    status: { id: string; from: string; to: string }[];
    steps: string[];
  } | null;
}

export async function readReport(sut: Sut, path = "$OUTPUT/spec-trace.json"): Promise<Report> {
  return JSON.parse(await sut.files.read(path)) as Report;
}

/** A base commit with SCN-SHOP-001 in the given status and its test; returns the commit. */
export async function baseCommit(sut: Sut, status = "implemented"): Promise<string> {
  await traced(sut, status);
  return sut.git.commit("base");
}

/** A proof bundle in $INPUT/<folder> with two artifacts for SCN-SHOP-001. */
export async function proofBundle(sut: Sut, folder = "evidence"): Promise<void> {
  const artifact = (path: string, kind: string, mediaType: string) => ({
    path,
    kind,
    mediaType,
    sha256: "0".repeat(64),
  });
  const manifest = {
    manifestVersion: 1,
    id: "01JABCDEVID0000000000000001",
    createdAt: "2026-01-01T00:00:00Z",
    subject: { repository: "https://github.com/acme/shop", commit: "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" },
    producer: { name: "proof", version: "0.1.0" },
    result: "passed",
    scenarios: [{ id: "SCN-SHOP-001", result: "passed", artifacts: ["shot.png", "trace.zip"] }],
    artifacts: [
      artifact("shot.png", "screenshot", "image/png"),
      artifact("trace.zip", "playwright-trace", "application/zip"),
    ],
  };
  await sut.files.put(`$INPUT/${folder}/evidence.json`, JSON.stringify(manifest));
}

/** The report the action named in its output "report", a path in the workspace $INPUT. */
export async function actionReport(sut: Sut, outputs: Record<string, string>): Promise<Report> {
  if (!outputs.report) throw new Error("the action named no report");
  return readReport(sut, `$INPUT/${outputs.report}`);
}
