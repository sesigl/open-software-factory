// The suites of the osf suite-plan scenarios: modules with system tests, their budgets and .github/test-suites.yml.
import type { scenario } from "@opensoftware/testkit";

type Sut = Parameters<Parameters<typeof scenario>[1]>[0]["sut"];

export type Suite = Record<string, unknown> & { suite: string };

/** Module `name` with system tests and, unless `budget` is undefined, its budget line in AGENTS.md (ADR 0155). */
export async function budgetedModule(sut: Sut, name: string, budget: number | undefined): Promise<void> {
  const manifest = {
    name: `@opensoftware/${name}`,
    version: "0.1.0",
    scripts: { "test:system": "testkit timed vitest run" },
  };
  await sut.files.put(`$INPUT/modules/${name}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  const line = budget === undefined ? "" : `System tests: ${budget} seconds of wall time on the CI runner.\n`;
  await sut.files.put(`$INPUT/modules/${name}/AGENTS.md`, `# ${name}\n\n## Budget\n\n${line}`);
}

/** The workspace and its suites file, written as JSON, which is YAML too. */
export async function suitesFile(sut: Sut, suites: Suite[]): Promise<void> {
  await sut.files.put("$INPUT/pnpm-workspace.yaml", "packages:\n  - modules/*\n");
  await sut.files.put("$INPUT/.github/test-suites.yml", `${JSON.stringify(suites, null, 2)}\n`);
}

/** The suite of one module, `@opensoftware/<name>`, with more fields. */
export const suite = (name: string, fields: Record<string, unknown> = {}): Suite => ({
  suite: name,
  filter: `@opensoftware/${name}`,
  ...fields,
});

/** The jobs that `osf suite-plan` printed. */
export const jobsOf = (stdout: string): Suite[] => JSON.parse(stdout) as Suite[];
