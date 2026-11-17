// `osf suite-plan --all | <suite>...`: the jobs of the tests matrix of verify.yml as JSON (ADR 0094, ADR 0163). Each
// suite of .github/test-suites.yml gets a job of its own, except the small ones: a suite whose units' budgets add up to
// at most 80 s (twice the measured wall time, ADR 0155, so under 40 s of tests), that names its packages and starts no
// kind cluster, shares one of two jobs with the other small suites. A shared job runs its suites' filters in one
// `make verify-tests`, one test task at a time, so BUDGET still reads each unit's own wall time. A new suite, or a
// budget that changes, moves between the jobs without a change in a workflow.
import { parse } from "yaml";
import { Repo } from "../checks/lib/repo.ts";
import { workspace } from "../checks/lib/workspace.ts";
import { budgetOf } from "../checks/results.ts";

const SUITES = ".github/test-suites.yml";
/** The largest budget of a suite that shares a job: twice its tests' wall time of under 40 s (ADR 0155). */
const SHARED_BUDGET = 80;
/** The jobs that the small suites share. */
const SHARED_JOBS = 2;

type Suite = Record<string, unknown> & { suite: string; filter?: string };

export function suitePlan(root: string, args: string[]): number {
  const repo = new Repo(root);
  const list = ((repo.exists(SUITES) ? parse(repo.read(SUITES)) : []) ?? []) as Suite[];
  const names = args.filter((arg) => arg !== "--all");
  const unknown = names.filter((name) => !list.some((each) => each.suite === name));
  if (unknown.length > 0) {
    console.error(`osf suite-plan: no suite ${unknown.join(", ")} in ${SUITES}`);
    return 1;
  }
  const planned = args.includes("--all") ? list : list.filter((each) => names.includes(each.suite));
  console.log(JSON.stringify(jobs(repo, planned)));
  return 0;
}

/** The jobs of the planned suites, in the order of their first suite in the suites file. */
function jobs(repo: Repo, planned: Suite[]): Suite[] {
  const units = workspace(repo).filter((unit) => unit.tested);
  const budgets = new Map(planned.map((each) => [each.suite, sharedBudget(repo, units, each)] as const));
  const small = planned.filter((each) => budgets.get(each.suite) !== undefined);
  // Longest first, each into the job with the least budget so far: the two jobs end at about the same time.
  const bins: Suite[][] = Array.from({ length: Math.min(SHARED_JOBS, small.length) }, () => []);
  const load = (bin: Suite[]) => bin.reduce((sum, each) => sum + (budgets.get(each.suite) ?? 0), 0);
  const longest = [...small].sort((a, b) => (budgets.get(b.suite) ?? 0) - (budgets.get(a.suite) ?? 0));
  for (const each of longest) {
    const bin = bins.reduce((least, candidate) => (load(candidate) < load(least) ? candidate : least));
    bin.push(each);
  }
  const position = (each: Suite) => planned.indexOf(each);
  const shared = bins.map((bin) => bin.sort((a, b) => position(a) - position(b)));
  const alone = planned.filter((each) => !small.includes(each)).map((each) => [each]);
  return [...shared, ...alone]
    .sort((a, b) => position(a[0] as Suite) - position(b[0] as Suite))
    .map((group) => (group.length === 1 ? (group[0] as Suite) : join(group)));
}

/**
 * The sum of the budgets of the suite's units when the suite may share a job, else undefined: its filter names its
 * packages (a filter with "!" runs every other package), it starts no kind cluster and sets no timeout of its own, and
 * each of its units has a budget.
 */
function sharedBudget(repo: Repo, units: { dir: string; name: string }[], suite: Suite): number | undefined {
  const parts = (suite.filter ?? "").split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.startsWith("!"))) return undefined;
  if (suite.kind || suite.cluster || suite.timeout) return undefined;
  let sum = 0;
  for (const part of parts) {
    const unit = units.find((each) => each.name === part);
    const budget = unit && budgetOf(repo, unit.dir);
    if (budget === undefined) return undefined;
    sum += budget;
  }
  return sum <= SHARED_BUDGET ? sum : undefined;
}

/** One job for several suites: their filters, the images of each, and Chromium when one of them opens pages. */
function join(group: Suite[]): Suite {
  const words = (field: string) => [
    ...new Set(
      group.flatMap((each) =>
        String(each[field] ?? "")
          .split(/\s+/)
          .filter(Boolean),
      ),
    ),
  ];
  const job: Suite = { suite: group.map((each) => each.suite).join("+"), filter: words("filter").join(" ") };
  for (const field of ["images", "pull"]) if (words(field).length > 0) job[field] = words(field).join(" ");
  const browser = group.find((each) => each.browser)?.browser;
  if (browser) job.browser = browser;
  return job;
}
