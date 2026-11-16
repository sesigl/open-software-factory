// `osf check`: runs checks by ID and prints one line per finding: `ID file:line message`.
import { type Check, Context } from "./lib/context.ts";
import { type Finding, Repo } from "./lib/repo.ts";

/**
 * A check whose module loads only when the check runs. The modules import heavy libraries (dependency-cruiser,
 * ts-morph, a native template parser): a start of `osf check` for one check loads only what that check needs.
 */
const lazy =
  (load: () => Promise<Check>): Check =>
  async (context) =>
    (await load())(context);

const boundary = () => import("./boundary.ts");
const design = () => import("./design.ts");
const docs = () => import("./docs.ts");
const quality = () => import("./quality.ts");
const results = () => import("./results.ts");
const visionModule = () => import("./vision.ts");

/** The fast set: static checks that need no test run and no base. SPEC, TRACE, STEPS and PASS are spec-trace's. */
export const FAST: Record<string, Check> = {
  NOSKIP: lazy(async () => (await boundary()).noskip),
  ASSERT: lazy(async () => (await boundary()).assert),
  "UI-QUERY": lazy(async () => (await boundary()).uiQuery),
  "BOUNDARY-STATIC": lazy(async () => (await boundary()).boundaryStatic),
  "BOUNDARY-ENV": lazy(async () => (await boundary()).boundaryEnv),
  ISOLATION: lazy(async () => (await boundary()).isolation),
  ARCH: lazy(async () => (await import("./arch.ts")).arch),
  TEMPLATE: lazy(async () => (await import("./templates.ts")).template),
  SURFACE: lazy(async () => (await import("./surface.ts")).surface),
  CONTRAST: lazy(async () => (await design()).contrast),
  TOKENS: lazy(async () => (await design()).tokens),
  DUP: lazy(async () => (await quality()).dup),
  "DOCS-GEN": lazy(async () => (await docs()).docsGen),
  "DOCS-LINKS": lazy(async () => (await docs()).docsLinks),
  ADR: lazy(async () => (await docs()).adr),
  AFFECTED: lazy(async () => (await import("./affected.ts")).affected),
  RELEASE: lazy(async () => (await import("./release.ts")).release),
  DEPS: lazy(async () => (await import("./deps.ts")).deps),
  "DEPS-RUNTIME": lazy(async () => (await import("./shipped.ts")).depsRuntime),
  PROFILE: lazy(async () => (await import("./profile.ts")).profile),
  VISION: lazy(async () => (await visionModule()).vision),
  TODO: lazy(async () => (await visionModule()).todo),
};

/** Checks that read test results or compare with OSF_BASE; `make verify` runs them after the tests. */
export const SLOW: Record<string, Check> = {
  FLAKE: lazy(async () => (await results()).flake),
  BUDGET: lazy(async () => (await results()).budget),
  "DOCS-AFFECTED": lazy(async () => (await docs()).docsAffected),
  CONTRACT: lazy(async () => (await import("./contract.ts")).contract),
  REACH: lazy(async () => (await import("./reach.ts")).reach),
  RUNS: lazy(async () => (await import("./runs.ts")).runs),
};

/** Checks that read the results of a separate run: MUTATION reads the Stryker reports of `make mutation`. */
export const SEPARATE: Record<string, Check> = {
  MUTATION: lazy(async () => (await quality()).mutation),
};

const ALL: Record<string, Check> = { ...FAST, ...SLOW, ...SEPARATE };

/** Checks with parts that run without a base (ADR: modules; CONTRACT: fixtures; RUNS: the records). */
const PARTLY_BASED = new Set(["ADR", "CONTRACT", "RUNS"]);

export async function runChecks(root: string, args: string[]): Promise<number> {
  const ids = args.filter((arg) => !arg.startsWith("--"));
  const unknown = ids.filter((id) => !(id in ALL));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown check: ${unknown.join(", ")}. Known: ${Object.keys(ALL).join(", ")}\n`);
    return 2;
  }
  const selected = ids.length > 0 ? ids : Object.keys(args.includes("--all") ? { ...FAST, ...SLOW } : FAST);
  const context = new Context(new Repo(root), { list: args.includes("--list"), total: args.includes("--total") });

  let failed = 0;
  for (const id of selected) {
    let findings: Finding[];
    try {
      findings = await (ALL[id] as Check)(context);
    } catch (error) {
      findings = [{ check: id, message: error instanceof Error ? error.message : String(error) }];
    }
    for (const finding of findings.sort(byLocation)) process.stdout.write(`${format(finding)}\n`);
    if (findings.length > 0) {
      process.stdout.write(`${id} failed: ${findings.length}\n`);
      failed++;
    } else if (context.skipped.has(id)) {
      const rest = PARTLY_BASED.has(id) ? "; the parts that need no base passed" : "";
      process.stdout.write(`${id} skipped: OSF_BASE is not set${rest}\n`);
    } else {
      process.stdout.write(`${id} ok\n`);
    }
  }
  for (const note of context.notes) process.stdout.write(`note: ${note}\n`);
  // A skipped check never passes a full run: `make verify` always compares with a base.
  if (args.includes("--all") && context.skipped.size > 0) {
    process.stdout.write(`check --all needs OSF_BASE: ${[...context.skipped].join(", ")} did not compare\n`);
    return 1;
  }
  return failed > 0 ? 1 : 0;
}

function format(finding: Finding): string {
  const where = finding.file ? ` ${finding.file}${finding.line ? `:${finding.line}` : ""}` : "";
  return `${finding.check}${where} ${finding.message}`;
}

function byLocation(a: Finding, b: Finding): number {
  return (a.file ?? "").localeCompare(b.file ?? "") || (a.line ?? 0) - (b.line ?? 0);
}
