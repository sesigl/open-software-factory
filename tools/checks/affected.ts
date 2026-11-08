// AFFECTED: the inputs of the cached system tests (ADR 0081). On a pull request, turbo replays the results of a suite
// whose hash did not change. The hash knows only what the suite declares, so this check makes the declarations
// complete: the workspace packages a system test starts, imports or reads, the repository-wide files, the suite of
// .github/test-suites.yml that runs each package, the jobs of verify.yml that plan, run and cache the suites (ADR 0094),
// where the suite writes its results, and that only pull requests use the cache.
import { dirname, join, normalize, relative } from "node:path";
import picomatch from "picomatch";
import { Node, Project } from "ts-morph";
import { parse } from "yaml";
import type { Context } from "./lib/context.ts";
import { type Finding, lineOf, type Repo } from "./lib/repo.ts";
import { type Unit, workspace } from "./lib/workspace.ts";

const ID = "AFFECTED";
const TURBO = "turbo.json";
const WORKFLOW = ".github/workflows/verify.yml";
/** The test suites of verify.yml; the job plan reads them (ADR 0094). */
const SUITES = ".github/test-suites.yml";
/** The matrix of the tests job: the suites that the job plan found work for. */
const PLANNED = "${{ fromJSON(needs.plan.outputs.suites) }}";
/** The one turbo cache of the jobs plan, tests and cache. */
const TESTS_CACHE = "turbo-tests-";
const MAKEFILE = "Makefile";
const JUNIT = "reports/junit.xml";
/** The repository-wide files that every system test depends on: tool pins, Node, the workspace and the CI job. */
export const TEST_GLOBALS = [
  MAKEFILE,
  ".nvmrc",
  "pnpm-workspace.yaml",
  "tools/scaffold/install-tools.ts",
  WORKFLOW,
  SUITES,
];
const INPUTS = ["$TURBO_DEFAULT$"];
const OUTPUTS = ["reports/**"];
/** Set explicitly: turbo then keeps the cache per worktree and CI saves this folder. */
const CACHE_DIR = ".turbo/cache";
/** A run of its own: the hash of every test task changes, and the builds stay cached. */
const FORCE = "$(if $(OSF_TEST_CACHE),,OSF_TEST_RUN=$$$$-$$(date +%s))";
const ENV = ["OSF_TEST_RUN"];
/** Lint, typecheck and build run again outside pull requests. */
const STATIC_FORCE = "$(if $(OSF_TEST_CACHE),,--force)";
const PULL_REQUEST = "github.event_name == 'pull_request'";

const finding = (file: string, line: number, message: string): Finding => ({ check: ID, file, line, message });

export function affected(context: Context): Finding[] {
  const { repo } = context;
  const units = workspace(repo);
  const findings = units.filter((unit) => unit.tested).flatMap((unit) => declarations(repo, unit, units));
  if (!repo.exists(TURBO)) return findings;
  return [
    ...findings,
    ...cache(repo),
    ...suites(repo, units),
    ...planned(repo),
    ...forced(repo),
    ...pullRequestsOnly(repo),
    ...withDependencies(repo),
  ];
}

/** What the system tests of `unit` start, import and read must be declared, and its JUnit results stay in it. */
function declarations(repo: Repo, unit: Unit, units: Unit[]): Finding[] {
  const findings: Finding[] = [];
  const manifest = `${unit.dir}/package.json`;
  const known = (name: string) => name === unit.name || unit.declared.has(name);
  const globals = globalDependencies(repo);
  for (const file of repo.match(`${unit.dir}/system-tests/**/*.{ts,mts,js,mjs}`)) {
    const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(`/${file}`, repo.read(file));
    source.forEachDescendant((node) => {
      const line = node.getStartLineNumber();
      if (Node.isCallExpression(node) && node.getExpression().getText().endsWith(".adapter")) {
        const [argument] = node.getArguments();
        if (!argument || !Node.isStringLiteral(argument)) return;
        const adapter = units.find((candidate) => candidate.dir === `adapters/${argument.getLiteralText()}`);
        if (adapter && !known(adapter.name)) {
          findings.push(
            finding(
              file,
              line,
              `starts the adapter "${argument.getLiteralText()}", which ${manifest} does not declare`,
            ),
          );
        }
        return;
      }
      if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) return;
      const text = node.getLiteralText();
      const parent = node.getParent();
      const imported = Node.isImportDeclaration(parent) || Node.isExportDeclaration(parent) || isDynamicImport(parent);
      if (imported && text.startsWith("@opensoftware/")) {
        const name = text.split("/").slice(0, 2).join("/");
        if (!known(name)) findings.push(finding(file, line, `imports "${name}", which ${manifest} does not declare`));
        return;
      }
      if (!text.startsWith("../") || !(imported || isFileRelative(node))) return;
      const target = normalize(join(dirname(file), text))
        .split("\\")
        .join("/");
      if (!relative(unit.dir, target).startsWith("..")) return;
      const owner = units.find((candidate) => target === candidate.dir || target.startsWith(`${candidate.dir}/`));
      if (owner && known(owner.name)) return;
      if (globals.some((global) => target === global || picomatch(global)(target))) return;
      findings.push(
        finding(
          file,
          line,
          `reads "${text}" outside its package: declare the package or list the file in globalDependencies of turbo.json`,
        ),
      );
    });
  }
  const config = repo.match(`${unit.dir}/vitest.config.{ts,mts,js,mjs}`)[0];
  if (config && !new RegExp(`outputFile:\\s*["'\`]${JUNIT}["'\`]`).test(repo.read(config))) {
    findings.push(
      finding(
        config,
        lineOf(repo.read(config), "junit"),
        `writes its JUnit results elsewhere than "${JUNIT}", which turbo stores and replays`,
      ),
    );
  }
  return findings;
}

const isDynamicImport = (node: Node | undefined): boolean =>
  Node.isCallExpression(node) && node.getExpression().getText() === "import";

const HERE = new Set(["import.meta.url", "import.meta.dirname", "__dirname"]);

/** A path relative to the test file: `new URL(path, import.meta.url)`, or `join`/`resolve` with its folder. */
function isFileRelative(node: Node): boolean {
  const call = node.getParent();
  if (!Node.isNewExpression(call) && !Node.isCallExpression(call)) return false;
  const args = call.getArguments().map((argument) => argument.getText());
  if (Node.isNewExpression(call)) return call.getExpression().getText() === "URL" && HERE.has(args[1] ?? "");
  return /(^|\.)(join|resolve)$/.test(call.getExpression().getText()) && args.some((arg) => HERE.has(arg));
}

function globalDependencies(repo: Repo): string[] {
  if (!repo.exists(TURBO)) return [];
  return (JSON.parse(repo.read(TURBO)) as { globalDependencies?: string[] }).globalDependencies ?? [];
}

/** test:system caches the whole package and replays its reports; the repository-wide files are in the hash. */
function cache(repo: Repo): Finding[] {
  const findings: Finding[] = [];
  const turbo = JSON.parse(repo.read(TURBO)) as {
    tasks?: Record<string, { cache?: boolean; inputs?: string[]; outputs?: string[]; env?: string[] }>;
  };
  const task = turbo.tasks?.["test:system"];
  const same = (a: string[] | undefined, b: string[]) => JSON.stringify(a ?? []) === JSON.stringify(b);
  if (task?.cache !== false && !(same(task?.inputs, INPUTS) && same(task?.outputs, OUTPUTS) && same(task?.env, ENV))) {
    findings.push(
      finding(
        TURBO,
        1,
        `test:system must cache with the inputs ${JSON.stringify(INPUTS)}, the outputs ${JSON.stringify(OUTPUTS)} and the env ${JSON.stringify(ENV)}`,
      ),
    );
  }
  if ((turbo as { cacheDir?: string }).cacheDir !== CACHE_DIR) {
    findings.push(
      finding(
        TURBO,
        1,
        `cacheDir must be "${CACHE_DIR}": results hold absolute paths, so a worktree must not replay those of another`,
      ),
    );
  }
  const globals = globalDependencies(repo);
  for (const file of TEST_GLOBALS.filter((global) => !globals.includes(global))) {
    findings.push(finding(TURBO, 1, `globalDependencies leave out "${file}", which every system test depends on`));
  }
  return findings;
}

/** Every package with system tests runs in exactly one suite, and each filter names a package with system tests. */
function suites(repo: Repo, units: Unit[]): Finding[] {
  if (!repo.exists(SUITES)) return [finding(SUITES, 1, "the list of the test suites of verify.yml is missing")];
  const text = repo.read(SUITES);
  const list = (parse(text) ?? []) as { suite?: string; filter?: string }[];
  const tested = new Set(units.filter((unit) => unit.tested).map((unit) => unit.name));
  const findings: Finding[] = [];
  const jobs = list.map(({ suite, filter }) => {
    const parts = (filter ?? "").split(/\s+/).filter(Boolean);
    for (const part of parts) {
      const name = part.replace(/^!/, "");
      if (tested.has(name)) continue;
      const line = lineOf(text, `suite: ${suite}`);
      findings.push(finding(SUITES, line, `the suite ${suite} names ${name}, which is no package with system tests`));
    }
    const only = parts.filter((part) => !part.startsWith("!"));
    const not = new Set(parts.filter((part) => part.startsWith("!")).map((part) => part.slice(1)));
    return { suite: suite ?? "?", runs: (name: string) => (only.length > 0 ? only.includes(name) : !not.has(name)) };
  });
  for (const unit of units.filter((candidate) => candidate.tested)) {
    const running = jobs.filter((job) => job.runs(unit.name)).map((job) => job.suite);
    const manifest = `${unit.dir}/package.json`;
    if (running.length === 0) {
      findings.push(finding(manifest, 1, `no suite of ${SUITES} runs the system tests of ${unit.name}`));
    } else if (running.length > 1) {
      const names = `${running.slice(0, -1).join(", ")} and ${running.at(-1)}`;
      findings.push(finding(manifest, 1, `the suites ${names} of ${SUITES} both run the system tests of ${unit.name}`));
    }
  }
  return findings;
}

interface Step {
  uses?: string;
  run?: string;
  with?: { path?: string; key?: string; "restore-keys"?: string };
}

/** The job plan reads the suites, the tests job runs the planned ones, and plan, tests and cache share one cache. */
function planned(repo: Repo): Finding[] {
  if (!repo.exists(WORKFLOW)) return [];
  const text = repo.read(WORKFLOW);
  const jobs = ((parse(text) ?? {}) as { jobs?: Record<string, { steps?: Step[]; strategy?: unknown }> }).jobs ?? {};
  const findings: Finding[] = [];
  const plan = jobs.plan?.steps ?? [];
  if (!plan.some((step) => step.run?.includes(SUITES))) {
    findings.push(finding(WORKFLOW, lineOf(text, "jobs:"), `the job plan must read the suites of ${SUITES}`));
  }
  const matrix = (jobs.tests?.strategy as { matrix?: { include?: unknown } } | undefined)?.matrix?.include;
  if (matrix !== PLANNED) {
    const line = lineOf(text, "  tests:");
    findings.push(finding(WORKFLOW, line, `the tests job must run the suites of the job plan: include: ${PLANNED}`));
  }
  for (const name of ["plan", "tests", "cache"]) {
    const caches = (jobs[name]?.steps ?? []).filter(
      (step) => step.uses?.startsWith("actions/cache") && step.with?.path === CACHE_DIR,
    );
    const keys = caches.flatMap((step) => [step.with?.key, step.with?.["restore-keys"]]).filter(Boolean) as string[];
    if (caches.length === 0 || keys.some((key) => !key.startsWith(TESTS_CACHE))) {
      const line = lineOf(text, `  ${name}:`);
      findings.push(finding(WORKFLOW, line, `the job ${name} must keep ${CACHE_DIR} in the cache ${TESTS_CACHE}`));
    }
  }
  return findings;
}

/** `make verify-tests` and `make verify-static` run everything unless OSF_TEST_CACHE asks for the cache. */
function forced(repo: Repo): Finding[] {
  if (!repo.exists(MAKEFILE)) return [];
  const text = repo.read(MAKEFILE);
  const recipe = /^verify-tests:.*\n((?:\t.*\n?)*)/m.exec(text)?.[1] ?? "";
  const findings: Finding[] = [];
  if (!recipe.includes(FORCE)) {
    findings.push(
      finding(
        MAKEFILE,
        lineOf(text, "verify-tests:"),
        `verify-tests must give each run its own test hash with ${FORCE}`,
      ),
    );
  }
  const statics = /^verify-static:.*\n((?:\t.*\n?)*)/m.exec(text)?.[1] ?? "";
  if (!statics.includes(STATIC_FORCE)) {
    findings.push(
      finding(
        MAKEFILE,
        lineOf(text, "verify-static:"),
        `verify-static must run lint, typecheck and build with ${STATIC_FORCE}`,
      ),
    );
  }
  return findings;
}

/** Only a pull request sets OSF_TEST_CACHE. */
function pullRequestsOnly(repo: Repo): Finding[] {
  if (!repo.exists(WORKFLOW)) return [];
  return repo
    .read(WORKFLOW)
    .split("\n")
    .flatMap((line, index) =>
      /OSF_TEST_CACHE\s*:/.test(line) && !line.includes(PULL_REQUEST)
        ? [
            finding(
              WORKFLOW,
              index + 1,
              "sets OSF_TEST_CACHE outside pull requests: only a pull request may replay test results",
            ),
          ]
        : [],
    );
}

/** `turbo run test:system --only` leaves the builds of the dependencies out of the test hash: a change in a
 * dependency would replay old results. */
function withDependencies(repo: Repo): Finding[] {
  return [MAKEFILE, WORKFLOW]
    .filter((file) => repo.exists(file))
    .flatMap((file) =>
      repo
        .read(file)
        .split("\n")
        .flatMap((line, index) =>
          /test:system\b.*--only\b/.test(line)
            ? [finding(file, index + 1, "runs test:system with --only, which leaves its dependencies out of the hash")]
            : [],
        ),
    );
}
