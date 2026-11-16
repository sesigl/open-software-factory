// BOUNDARY-STATIC, BOUNDARY-ENV, ISOLATION, NOSKIP and ASSERT: how tests and modules reach each other.

import { documentedEnv, isDocumented } from "@opensoftware/testkit/readme";
import type { Context } from "./lib/context.ts";
import { cruised } from "./lib/cruise.ts";
import { type Finding, isLibrary, lineOf, moduleRootOf } from "./lib/repo.ts";
import { loadTests } from "./lib/tests.ts";

/** The violations of `check` in the one import graph of the three checks (lib/cruise.ts). */
async function violations(context: Context, check: "BOUNDARY-STATIC" | "ISOLATION"): Promise<Finding[]> {
  const result = await cruised(context);
  return result.summary.violations
    .filter((violation) => violation.rule.name === check)
    .map((violation) => {
      // The specifier as written in the file, to point at its line.
      const dependency = result.modules
        .find((module) => module.source === violation.from)
        ?.dependencies.find((candidate) => candidate.resolved === violation.to);
      const text = context.repo.read(violation.from);
      // dependency-cruiser drops the `node:` prefix of built-in modules; find the specifier with or without it.
      const bare = dependency?.module ?? violation.to;
      const quoted = (name: string): RegExp => new RegExp(`["']${escapeRegExp(name)}["']`);
      const written = [bare, `node:${bare}`].find((name) => quoted(name).test(text)) ?? bare;
      const line = text.split("\n").findIndex((row) => quoted(written).test(row)) + 1 || 1;
      const message =
        check === "BOUNDARY-STATIC"
          ? `import "${written}" is not allowed in a system test; use @opensoftware/testkit, generated contract clients, the test framework or, in a library's test, the library`
          : `imports ${violation.to}; modules share data only through contracts/`;
      return { check, file: violation.from, line, message };
    });
}

export async function boundaryStatic(context: Context): Promise<Finding[]> {
  return violations(context, "BOUNDARY-STATIC");
}

export async function isolation(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const findings = await violations(context, "ISOLATION");

  // A module declares only @opensoftware/contracts, @opensoftware/testkit and the adapters its system tests start
  // (devDependencies, ADR 0081), the libraries in packages/ (ADR 0037) and external packages.
  const adapters = new Set(
    repo
      .match("adapters/*/*/package.json")
      .map((manifest) => (JSON.parse(repo.read(manifest)) as { name?: string }).name),
  );
  const libraries = new Set(
    repo
      .match("packages/*/package.json")
      .filter((manifest) => isLibrary(repo, manifest.slice(0, -"/package.json".length)))
      .map((manifest) => (JSON.parse(repo.read(manifest)) as { name?: string }).name),
  );
  for (const manifest of repo.match("modules/*/package.json")) {
    const text = repo.read(manifest);
    const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(json[section] ?? {})) {
        if (!name.startsWith("@opensoftware/") || name === "@opensoftware/contracts" || libraries.has(name)) continue;
        if ((name === "@opensoftware/testkit" || adapters.has(name)) && section === "devDependencies") continue;
        const why = name === "@opensoftware/testkit" ? "is allowed only in devDependencies" : "is another module";
        findings.push({
          check: "ISOLATION",
          file: manifest,
          line: lineOf(text, `"${name}"`),
          message: `${name} ${why}`,
        });
      }
    }
  }
  return findings;
}

export function boundaryEnv(context: Context): Finding[] {
  const findings: Finding[] = [];
  for (const test of loadTests(context.repo)) {
    if (test.env.length === 0) continue;
    const readme = `${moduleRootOf(test.file)}/README.md`;
    const documented = context.repo.exists(readme) ? documentedEnv(context.repo.read(readme)) : new Set<string>();
    for (const { name, line } of test.env) {
      if (!isDocumented(documented, name)) {
        findings.push({
          check: "BOUNDARY-ENV",
          file: test.file,
          line,
          message: `${name} is not documented in ${readme}#configuration`,
        });
      }
    }
  }
  return findings;
}

export function noskip(context: Context): Finding[] {
  return loadTests(context.repo).flatMap((test) =>
    test.skips.map(({ name, line }) => ({
      check: "NOSKIP",
      file: test.file,
      line,
      message: `${name} is not allowed in system tests; a test runs and passes, or its scenario stays planned`,
    })),
  );
}

export function uiQuery(context: Context): Finding[] {
  return loadTests(context.repo).flatMap((test) =>
    test.queries.map(({ name, line }) => ({
      check: "UI-QUERY",
      file: test.file,
      line,
      message: `${name} finds or waits by something other than role, label or text: use getByRole, getByLabel or getByText and wait for what the page shows (ADR 0131)`,
    })),
  );
}

export function assert(context: Context): Finding[] {
  const findings: Finding[] = [];
  for (const test of loadTests(context.repo).filter((file) => file.isTest)) {
    for (const scenario of test.scenarios) {
      for (const step of scenario.steps.filter((candidate) => candidate.keyword === "Then")) {
        const label = step.label ?? "(no literal label)";
        let message: string | undefined;
        if (step.assertions === 0) message = `then("${label}") has no assertion`;
        else if (!step.assertsOnSut)
          message = `then("${label}") asserts only on values the test created, not on sut or fakes`;
        if (message) findings.push({ check: "ASSERT", file: test.file, line: step.line, message });
      }
    }
  }
  return findings;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
