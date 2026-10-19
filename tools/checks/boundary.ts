// BOUNDARY-STATIC, BOUNDARY-ENV, ISOLATION, NOSKIP and ASSERT: how tests and modules reach each other.
import { dirname, posix } from "node:path";
import { cruise, type IReporterOutput } from "dependency-cruiser";
import type { Context } from "./lib/context.ts";
import { documentedEnv, type Finding, lineOf, moduleRootOf } from "./lib/repo.ts";

/** What a TypeScript system test may import besides files in its own system-tests folder. */
const TS_ALLOWED = [/^@osf\/testkit(\/|$)/, /^@osf\/contracts(\/|$)/, /^vitest(\/|$)/];
/** What a Python system test may not import: process, file and database access belong to the testkit. */
const PY_FORBIDDEN =
  /^(subprocess|shutil|sqlite3|socket|psycopg2?|sqlalchemy|pymongo|redis|requests|httpx|urllib)(\.|$)/;

export function boundaryStatic(context: Context): Finding[] {
  const findings: Finding[] = [];
  for (const test of context.tests()) {
    const folder = test.file.slice(0, test.file.indexOf("/system-tests/") + "/system-tests".length);
    for (const { name, line } of test.imports) {
      const reason = test.file.endsWith(".py") ? pythonReason(name) : typescriptReason(name, test.file, folder);
      if (reason)
        findings.push({ check: "BOUNDARY-STATIC", file: test.file, line, message: `import "${name}" ${reason}` });
    }
  }
  return findings;
}

function typescriptReason(name: string, file: string, folder: string): string | undefined {
  if (name.startsWith(".")) {
    const target = posix.normalize(posix.join(dirname(file), name));
    if (target.startsWith(`${folder}/`)) return undefined;
    return `reaches outside ${folder}/; system tests use only the module's public surface through @osf/testkit`;
  }
  if (TS_ALLOWED.some((pattern) => pattern.test(name))) return undefined;
  return "is not allowed in a system test; use @osf/testkit, generated contract clients or the test framework";
}

function pythonReason(name: string): string | undefined {
  if (/(^|\.)src(\.|$)/.test(name)) return "reaches into src/; system tests use only the module's public surface";
  if (PY_FORBIDDEN.test(name)) return "is not allowed in a system test; use osf_testkit";
  return undefined;
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

const MODULE_DIRS = ["modules", "ports", "adapters"];

export async function isolation(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const findings: Finding[] = [];

  // Source imports between modules, resolved by dependency-cruiser.
  const sources = repo.match("modules/*/**/*.{ts,tsx,js,mjs,cjs}").filter((file) => !file.includes("/system-tests/"));
  if (sources.length > 0) {
    const output = (await cruise(sources, {
      baseDir: repo.root,
      validate: true,
      doNotFollow: { path: "node_modules" },
      tsPreCompilationDeps: true,
      ruleSet: {
        forbidden: [
          {
            name: "ISOLATION",
            severity: "error",
            from: { path: "^modules/([^/]+)/" },
            to: { path: "^modules/", pathNot: "^modules/$1/" },
          },
        ],
      },
    })) as IReporterOutput;
    const result = typeof output.output === "string" ? undefined : output.output;
    for (const violation of result?.summary.violations ?? []) {
      const text = repo.read(violation.from);
      const specifier = violation.to.split("/").slice(-3).join("/");
      findings.push({
        check: "ISOLATION",
        file: violation.from,
        line: lineOf(text, specifier),
        message: `imports ${violation.to}; modules share data only through contracts/`,
      });
    }
  }

  // Python imports of another module's package.
  const names = new Set(repo.match("modules/*/**").map((file) => file.split("/")[1] as string));
  for (const test of context.tests()) {
    if (!test.file.startsWith("modules/") || !test.file.endsWith(".py")) continue;
    const own = test.file.split("/")[1] as string;
    for (const { name, line } of test.imports) {
      const other = [...names].find(
        (module) => module !== own && name.split(".")[0] === `osf_${module.replaceAll("-", "_")}`,
      );
      if (other) findings.push({ check: "ISOLATION", file: test.file, line, message: `imports module ${other}` });
    }
  }

  // Declared dependencies on other modules.
  for (const manifest of repo.match(...MODULE_DIRS.map((dir) => `${dir}/**/package.json`))) {
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
