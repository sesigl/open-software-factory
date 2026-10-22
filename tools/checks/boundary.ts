// BOUNDARY-STATIC, BOUNDARY-ENV, ISOLATION, NOSKIP and ASSERT: how tests and modules reach each other.

import { documentedEnv } from "@opensoftware/testkit/readme";
import { cruise, type ICruiseResult, type IForbiddenRuleType, type IReporterOutput } from "dependency-cruiser";
import type { Context } from "./lib/context.ts";
import { type Finding, isLibrary, lineOf, moduleRootOf } from "./lib/repo.ts";

/** What every system test may import besides its own folder. */
const TEST_IMPORTS = [
  "^@opensoftware/(testkit|contracts)(/|$)",
  "^vitest(/|$)",
  "^packages/(testkit|contracts)/",
  "^contracts/",
  "(^|/)node_modules/(@opensoftware/(testkit|contracts)|vitest|@vitest)/",
];

/**
 * A system test imports only files in its own system-tests folder, @opensoftware/testkit, generated contract clients
 * (@opensoftware/contracts) and the test framework. The tests of a library in packages/ also import the library by
 * its package name, which resolves to its built entry point (ADR 0039). Workspace packages resolve to their folders.
 */
const BOUNDARY_RULES: IForbiddenRuleType[] = [
  {
    name: "BOUNDARY-STATIC",
    severity: "error",
    from: { path: "^(.+/system-tests)/", pathNot: "^packages/" },
    to: { pathNot: ["^$1/", ...TEST_IMPORTS] },
  },
  {
    name: "BOUNDARY-STATIC",
    severity: "error",
    from: { path: "^packages/([^/]+)/system-tests/" },
    to: {
      pathNot: [
        "^packages/$1/system-tests/",
        "^@opensoftware/$1$",
        "^packages/$1/dist/index\\.(js|d\\.ts)$",
        "(^|/)node_modules/@opensoftware/$1/dist/index\\.(js|d\\.ts)$",
        ...TEST_IMPORTS,
      ],
    },
  },
];

/** No module imports another module; adapters do not import other adapters; ports import no module or adapter. */
const ISOLATION_RULES: IForbiddenRuleType[] = [
  {
    name: "ISOLATION",
    severity: "error",
    from: { path: "^modules/([^/]+)/", pathNot: "/system-tests/" },
    to: { path: "^(modules|adapters)/", pathNot: "^modules/$1/" },
  },
  {
    name: "ISOLATION",
    severity: "error",
    from: { path: "^adapters/([^/]+/[^/]+)/", pathNot: "/system-tests/" },
    to: { path: "^(modules|adapters)/", pathNot: "^adapters/$1/" },
  },
  {
    name: "ISOLATION",
    severity: "error",
    from: { path: "^ports/([^/]+)/", pathNot: "/system-tests/" },
    to: { path: "^(modules|adapters)/" },
  },
];

async function violations(context: Context, files: string[], rules: IForbiddenRuleType[]): Promise<Finding[]> {
  if (files.length === 0) return [];
  const output = (await cruise(files, {
    baseDir: context.repo.root,
    validate: true,
    // Only the listed files, each with its own imports. maxDepth 1 skipped the imports of a listed file that
    // another listed file reached first.
    doNotFollow: { path: ".+" },
    tsPreCompilationDeps: true,
    ruleSet: { forbidden: rules },
  })) as IReporterOutput;
  const result = output.output as ICruiseResult;
  return result.summary.violations.map((violation) => {
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
    const check = violation.rule.name;
    const message =
      check === "BOUNDARY-STATIC"
        ? `import "${written}" is not allowed in a system test; use @opensoftware/testkit, generated contract clients, the test framework or, in a library's test, the library`
        : `imports ${violation.to}; modules share data only through contracts/`;
    return { check, file: violation.from, line, message };
  });
}

export async function boundaryStatic(context: Context): Promise<Finding[]> {
  return violations(
    context,
    context.tests().map((test) => test.file),
    BOUNDARY_RULES,
  );
}

export async function isolation(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const sources = repo
    .match("{modules,ports}/*/**/*.{ts,tsx,js,mjs,cjs}", "adapters/*/*/**/*.{ts,tsx,js,mjs,cjs}")
    .filter((file) => !file.includes("/system-tests/") && !file.includes("/node_modules/"));
  const findings = await violations(context, sources, ISOLATION_RULES);

  // A module declares only @opensoftware/contracts, @opensoftware/testkit (devDependencies), the libraries in
  // packages/ (ADR 0037) and external packages.
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
        if (name === "@opensoftware/testkit" && section === "devDependencies") continue;
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
  for (const test of context.tests()) {
    if (test.env.length === 0) continue;
    const readme = `${moduleRootOf(test.file)}/README.md`;
    const documented = context.repo.exists(readme) ? documentedEnv(context.repo.read(readme)) : new Set<string>();
    for (const { name, line } of test.env) {
      if (!documented.has(name)) {
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
  return context.tests().flatMap((test) =>
    test.skips.map(({ name, line }) => ({
      check: "NOSKIP",
      file: test.file,
      line,
      message: `${name} is not allowed in system tests; a test runs and passes, or its scenario stays planned`,
    })),
  );
}

export function assert(context: Context): Finding[] {
  const findings: Finding[] = [];
  for (const test of context.tests().filter((file) => file.isTest)) {
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
