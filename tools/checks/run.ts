// `osf check`: runs checks by ID and prints one line per finding: `ID file:line message`.
import { arch } from "./arch.ts";
import { boundaryEnv, boundaryStatic, assert as checkAssert, isolation, noskip } from "./boundary.ts";
import { contract } from "./contract.ts";
import { adr, docsAffected, docsGen, docsLinks } from "./docs.ts";
import { type Check, Context } from "./lib/context.ts";
import { type Finding, Repo } from "./lib/repo.ts";
import { reach } from "./reach.ts";
import { budget, flake } from "./results.ts";
import { runs } from "./runs.ts";

/** The fast set: static checks that need no test run and no base. SPEC, TRACE, STEPS and PASS are spec-trace's. */
export const FAST: Record<string, Check> = {
  NOSKIP: noskip,
  ASSERT: checkAssert,
  "BOUNDARY-STATIC": boundaryStatic,
  "BOUNDARY-ENV": boundaryEnv,
  ISOLATION: isolation,
  ARCH: arch,
  "DOCS-GEN": docsGen,
  "DOCS-LINKS": docsLinks,
  ADR: adr,
};

/** Checks that read test results or compare with OSF_BASE; `make verify` runs them after the tests. */
export const SLOW: Record<string, Check> = {
  FLAKE: flake,
  BUDGET: budget,
  "DOCS-AFFECTED": docsAffected,
  CONTRACT: contract,
  REACH: reach,
  RUNS: runs,
};

const ALL: Record<string, Check> = { ...FAST, ...SLOW };

/** Checks with parts that run without a base (ADR: modules; CONTRACT: fixtures; RUNS: the records). */
const PARTLY_BASED = new Set(["ADR", "CONTRACT", "RUNS"]);

export async function runChecks(root: string, args: string[]): Promise<number> {
  const ids = args.filter((arg) => !arg.startsWith("--"));
  const unknown = ids.filter((id) => !(id in ALL));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown check: ${unknown.join(", ")}. Known: ${Object.keys(ALL).join(", ")}\n`);
    return 2;
  }
  const selected = ids.length > 0 ? ids : Object.keys(args.includes("--all") ? ALL : FAST);
  const context = new Context(new Repo(root), { list: args.includes("--list") });

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
