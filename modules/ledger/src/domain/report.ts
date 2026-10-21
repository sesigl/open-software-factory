// The report: what the views say about one period, as JSON and as Markdown (ADR 0034).

export interface Options {
  since: string | null;
  until: string | null;
  target: number | null;
  computeUsdPerHour: number;
  platformUsd: number;
}

export interface Slice {
  name: string;
  usd: number;
  share: number;
}

/** The query results the report is built from; amounts in USD, durations in hours. */
export interface Facts {
  opened: number;
  merged: number;
  perDay: { date: string; opened: number; merged: number }[];
  cycle: Record<"kickoffToPullRequest" | "kickoffToMerge" | "pullRequestToFirstHumanReview" | "firstHumanReviewToMerge", number | null>;
  interactions: { perPullRequest: number | null; perDay: { date: string; perPullRequest: number }[] };
  runs: { total: number; topLevel: number; byAgent: { agent: string; total: number; topLevel: number }[] };
  reverts: number;
  spend: { total: number; unattributed: number; bySource: Slice[]; byUser: Slice[]; byAgent: Slice[]; byModel: Slice[] };
  hours: number;
  top: { url: string; title: string; usd: number }[];
}

export const cents = (usd: number): number => Math.round(usd * 100) / 100;
const hundredths = (value: number | null): number | null => (value === null ? null : Math.round(value * 100) / 100);
const share = (part: number, whole: number): number => (whole ? Math.round((part / whole) * 10_000) / 10_000 : 0);

export function buildReport(facts: Facts, options: Options) {
  const compute = facts.hours * options.computeUsdPerHour;
  const total = facts.spend.total + compute + options.platformUsd;
  const perPullRequest = facts.opened ? total / facts.opened : null;
  const slices = (list: Slice[]) => list.map(({ name, usd }) => ({ name, usd: cents(usd), share: share(usd, facts.spend.total) }));
  return {
    period: { since: options.since, until: options.until },
    pullRequests: { opened: facts.opened, merged: facts.merged, perDay: facts.perDay },
    cost: {
      total: cents(total),
      inference: cents(facts.spend.total),
      compute: cents(compute),
      platform: cents(options.platformUsd),
    },
    costPerPullRequest:
      perPullRequest === null
        ? null
        : {
            usd: cents(perPullRequest),
            inference: cents(facts.spend.total / facts.opened),
            compute: cents(compute / facts.opened),
            platform: cents(options.platformUsd / facts.opened),
            target: options.target === null ? null : cents(options.target),
            gap: options.target === null ? null : cents(perPullRequest - options.target),
          },
    spend: {
      total: cents(facts.spend.total),
      unattributed: cents(facts.spend.unattributed),
      bySource: slices(facts.spend.bySource),
      byUser: slices(facts.spend.byUser),
      byAgent: slices(facts.spend.byAgent),
      byModel: slices(facts.spend.byModel),
    },
    topPullRequests: facts.top.map((pr) => ({ ...pr, usd: cents(pr.usd) })),
    cycleTime: Object.fromEntries(Object.entries(facts.cycle).map(([key, hours]) => [key, hundredths(hours)])),
    humanInteractions: {
      perPullRequest: hundredths(facts.interactions.perPullRequest),
      perDay: facts.interactions.perDay.map((day) => ({ ...day, perPullRequest: hundredths(day.perPullRequest) })),
    },
    runs: facts.runs,
    revertRate: { rate: facts.merged ? share(facts.reverts, facts.merged) : null, reverts: facts.reverts, merged: facts.merged },
  };
}

export type Report = ReturnType<typeof buildReport>;

const usd = (value: number | null | undefined): string => (value == null ? "-" : `${value.toFixed(2)} USD`);
const hours = (value: unknown): string => (value == null ? "-" : `${value} h`);
const percent = (value: number | null): string => (value === null ? "-" : `${(value * 100).toFixed(1)}%`);

/** One line for standard output. */
export function summary(report: Report): string {
  return `${report.pullRequests.opened} pull requests, cost per pull request ${usd(report.costPerPullRequest?.usd)}, revert rate ${percent(report.revertRate.rate)}`;
}

export function markdown(report: Report): string {
  const { since, until } = report.period;
  const table = (head: string[], rows: unknown[][]) =>
    [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  const slices = (title: string, list: Slice[]) =>
    `### By ${title}\n\n${table([title, "Spend", "Share"], list.map((slice) => [slice.name, usd(slice.usd), percent(slice.share)]))}`;
  const cost = report.costPerPullRequest;
  const cycle = report.cycleTime;
  return `${[
    `# Ledger report: ${since ?? "start"} to ${until ?? "end"}`,
    "## Throughput",
    table(["Measure", "Value"], [
      ["Pull requests opened", report.pullRequests.opened],
      ["Pull requests merged", report.pullRequests.merged],
      ["Human interactions per pull request", report.humanInteractions.perPullRequest ?? "-"],
      ["Runs", report.runs.total],
      ["Top-level runs", report.runs.topLevel],
    ]),
    table(["Day", "Opened", "Merged"], report.pullRequests.perDay.map((day) => [day.date, day.opened, day.merged])),
    "## Cycle time",
    table(["Segment", "Median"], [
      ["Kickoff to pull request", hours(cycle.kickoffToPullRequest)],
      ["Kickoff to merge", hours(cycle.kickoffToMerge)],
      ["Pull request to first human review", hours(cycle.pullRequestToFirstHumanReview)],
      ["First human review to merge", hours(cycle.firstHumanReviewToMerge)],
    ]),
    "## Cost",
    table(["Measure", "Value"], [
      ["Cost per pull request", usd(cost?.usd)],
      ["Inference per pull request", usd(cost?.inference)],
      ["Compute per pull request", usd(cost?.compute)],
      ["Platform per pull request", usd(cost?.platform)],
      ["Target", usd(cost?.target)],
      ["Gap to target", usd(cost?.gap)],
    ]),
    table(["Pull request", "Title", "Cost"], report.topPullRequests.map((pr) => [pr.url, pr.title, usd(pr.usd)])),
    "## Spend",
    table(["Measure", "Value"], [
      ["Total", usd(report.spend.total)],
      ["Unattributed", usd(report.spend.unattributed)],
    ]),
    slices("source", report.spend.bySource),
    slices("user", report.spend.byUser),
    slices("agent", report.spend.byAgent),
    slices("model", report.spend.byModel),
    "## Revert rate",
    table(["Reverts", "Merged", "Rate"], [[report.revertRate.reverts, report.revertRate.merged, percent(report.revertRate.rate)]]),
  ].join("\n\n")}\n`;
}
