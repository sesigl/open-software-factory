// The library packages/money with the implemented scenario SCN-MONEY-001, for the checks of libraries (ADR 0039).

export const MONEY_TEST = "packages/money/system-tests/SCN-MONEY-001.test.ts";

/** The files of the library; its system test imports `specifier` on line 2 and calls `cents`. */
export function moneyLibrary(specifier: string): Record<string, string> {
  return {
    "docs/reference/scenario-prefixes.md": [
      "| Prefix | Owner | Path |",
      "| --- | --- | --- |",
      "| MONEY | money | `packages/money/features/` |",
      "",
    ].join("\n"),
    "packages/money/package.json": `${JSON.stringify({ name: "@opensoftware/money", version: "0.1.0", type: "module" }, null, 2)}\n`,
    "packages/money/src/index.ts": "export const cents = (value: number) => value * 100;\n",
    "packages/money/features/money.feature": [
      "@module=money",
      "Feature: Money",
      "",
      "  @id=SCN-MONEY-001 @status=implemented",
      "  Scenario: Cents of an amount",
      "    When the module asks for the cents of 2",
      "    Then it gets 200",
      "",
    ].join("\n"),
    [MONEY_TEST]: [
      'import { scenario } from "@opensoftware/testkit";',
      `import { cents } from ${JSON.stringify(specifier)};`,
      "",
      'scenario("SCN-MONEY-001", async ({ when, then }) => {',
      "  let value = 0;",
      '  await when("the module asks for the cents of 2", async () => {',
      "    value = cents(2);",
      "  });",
      '  await then("it gets 200", async () => {',
      "    expect(value).toBe(200);",
      "  });",
      "});",
      "",
    ].join("\n"),
  };
}
