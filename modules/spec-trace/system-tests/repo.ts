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
}

export async function readReport(sut: Sut, path = "$OUTPUT/spec-trace.json"): Promise<Report> {
  return JSON.parse(await sut.files.read(path)) as Report;
}
