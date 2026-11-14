// Shared step bodies of the AFFECTED scenarios (ADR 0081). Each test names its steps itself, so STEPS can read them.
import { cachedRepository, putAll } from "./repo.ts";

type Sut = Parameters<typeof putAll>[0] & {
  cli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

export const DEMO_TEST_FILE = "modules/demo/system-tests/SCN-DEMO-001.test.ts";

/** A system test of demo whose third line is `line`. */
export const demoTest = (line: string, first = 'import { scenario } from "@opensoftware/testkit";'): string =>
  `${first}\nscenario("SCN-DEMO-001", async ({ sut }) => {\n  ${line}\n});\n`;

/** Puts the repository that follows the rules, then `change` over it. */
export const putCached = (sut: Sut, change: Record<string, string> = {}): Promise<void> =>
  putAll(sut, { ...cachedRepository(), ...change });

export const runAffected = (sut: Sut) => sut.cli(["check", "AFFECTED"]);

/**
 * A line of demo's system test that opens a page in Chromium. The text is put together, because AFFECTED and the
 * mutation shards find a package that opens pages by this text in its system tests, and tools' tests open none.
 */
export const opensPage = `const page = await sut.browser.${"open"}("/");`;
