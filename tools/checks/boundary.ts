// BOUNDARY-STATIC, BOUNDARY-ENV, ISOLATION, NOSKIP and ASSERT: how tests and modules reach each other.
import { cruise, type ICruiseResult, type IForbiddenRuleType, type IReporterOutput } from "dependency-cruiser";
import type { Context } from "./lib/context.ts";
import { documentedEnv, type Finding, lineOf, moduleRootOf } from "./lib/repo.ts";

/**
 * A system test imports only files in its own system-tests folder, @osf/testkit, generated contract clients
 * (@osf/contracts) and the test framework. Workspace packages resolve to their source folders.
 */
const BOUNDARY_RULES: IForbiddenRuleType[] = [
  {
    name: "BOUNDARY-STATIC",
    severity: "error",
    from: { path: "^(.+/system-tests)/" },
    to: {
      pathNot: [
        "^$1/",
        "^@osf/(testkit|contracts)(/|$)",
        "^vitest(/|$)",
        "^packages/(testkit|contracts)/",
        "^contracts/",
        "(^|/)node_modules/(@osf/(testkit|contracts)|vitest|@vitest)/",
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
    maxDepth: 1,
    tsPreCompilationDeps: true,
    ruleSet: { forbidden: rules },
  })) as IReporterOutput;
  const result = output.output as ICruiseResult;
  return result.summary.violations.map((violation) => {
    // The specifier as written in the file, to point at its line.
    const dependency = result.modules
      .find((module) => module.source === violation.from)
      ?.dependencies.find((candidate) => candidate.resolved === violation.to);
    const written = dependency?.module ?? violation.to;
    const text = context.repo.read(violation.from);
    const check = violation.rule.name;
    const message =
      check === "BOUNDARY-STATIC"
        ? `import "${written}" is not allowed in a system test; use @osf/testkit, generated contract clients or the test framework`
        : `imports ${violation.to}; modules share data only through contracts/`;
    return { check, file: violation.from, line: lineOf(text, `"${written}"`), message };
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

  // A module declares only @osf/contracts, @osf/testkit (devDependencies) and external packages.
  for (const manifest of repo.match("modules/*/package.json")) {
    const text = repo.read(manifest);
    const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(json[section] ?? {})) {
        if (!name.startsWith("@osf/") || name === "@osf/contracts") continue;
        if (name === "@osf/testkit" && section === "devDependencies") continue;
        const why = name === "@osf/testkit" ? "is allowed only in devDependencies" : "is another module";
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
