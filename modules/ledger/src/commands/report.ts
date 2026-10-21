// ledger report: query the views for one period and write report.json and, when asked, Markdown.

import { writeText } from "../adapters/files.ts";
import type { Ledger, Parameter, Row } from "../adapters/ledger.ts";
import { buildReport, type Facts, markdown, type Options, type Slice, summary } from "../domain/report.ts";

/** The period as [from, to) timestamps; an open end is infinity. */
const bounds = ({ since, until }: Options): string[] => [
  since ?? "-infinity",
  until ? new Date(Date.parse(`${until}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "infinity",
];

const between = (column: string) => `${column} >= $1::TIMESTAMP AND ${column} < $2::TIMESTAMP`;

export async function report(
  ledger: Ledger,
  options: Options,
  files: { out: string; markdown: string | undefined },
): Promise<string[]> {
  const period = bounds(options);
  const one = async (statement: string, parameters: Parameter[] = period) =>
    (await ledger.query(statement, parameters))[0] as Row;
  const all = (statement: string, parameters: Parameter[] = period) => ledger.query(statement, parameters);
  // The same queries on DuckDB and PostgreSQL (ADR 0035); the dialect fills in what differs.
  const { hours, day, sorted } = ledger.dialect;
  const median = (from: string, to: string) => `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${hours(from, to)})`;

  const totals = await one(`SELECT
      count(*) FILTER (WHERE ${between("opened_at")})::INTEGER AS opened,
      count(*) FILTER (WHERE ${between("merged_at")})::INTEGER AS merged,
      count(*) FILTER (WHERE ${between("merged_at")} AND is_revert)::INTEGER AS reverts,
      (avg(human_interactions) FILTER (WHERE ${between("opened_at")}))::DOUBLE PRECISION AS interactions
    FROM pr_flow`);
  const perDay = await all(`SELECT ${day("day")} AS date, sum(opened)::INTEGER AS opened, sum(merged)::INTEGER AS merged
    FROM (SELECT opened_at::DATE AS day, 1 AS opened, 0 AS merged FROM pr_flow WHERE ${between("opened_at")}
          UNION ALL SELECT merged_at::DATE, 0, 1 FROM pr_flow WHERE ${between("merged_at")}) AS days
    GROUP BY day ORDER BY day`);
  const cycle = await one(`SELECT
      ${median("kickoff_at", "opened_at")} AS "kickoffToPullRequest",
      ${median("kickoff_at", "merged_at")} AS "kickoffToMerge",
      ${median("opened_at", "first_human_review_at")} AS "pullRequestToFirstHumanReview",
      ${median("first_human_review_at", "merged_at")} AS "firstHumanReviewToMerge"
    FROM pr_flow WHERE ${between("opened_at")}`);
  const interactionsPerDay =
    await all(`SELECT ${day("opened_at::DATE")} AS date, avg(human_interactions)::DOUBLE PRECISION AS "perPullRequest"
    FROM pr_flow WHERE ${between("opened_at")} GROUP BY 1 ORDER BY 1`);
  const runs = await one(`SELECT count(*)::INTEGER AS total, count(*) FILTER (WHERE top_level)::INTEGER AS "topLevel",
      coalesce(sum(hours), 0) AS hours FROM run_cost WHERE ${between("started_at")}`);
  const byAgent =
    await all(`SELECT agent, count(*)::INTEGER AS total, count(*) FILTER (WHERE top_level)::INTEGER AS "topLevel"
    FROM run_cost WHERE ${between("started_at")} GROUP BY agent ORDER BY total DESC, ${sorted("agent")}`);
  const spend =
    await one(`SELECT coalesce(sum(usd), 0) AS total, coalesce(sum(usd) FILTER (WHERE run_id IS NULL), 0) AS unattributed
    FROM spend_attributed WHERE ${between("spent_at")}`);
  const slice = async (column: string) =>
    (await all(`SELECT ${column} AS name, sum(usd) AS usd FROM spend_attributed WHERE ${between("spent_at")}
      GROUP BY ${column} ORDER BY usd DESC, ${sorted(column)}`)) as unknown as Slice[];
  const top = await all(
    `SELECT url, title, inference_usd + hours * $3 AS usd FROM pr_cost WHERE ${between("opened_at")}
      ORDER BY usd DESC, ${sorted("url")} LIMIT 20`,
    [...period, options.computeUsdPerHour],
  );

  const facts: Facts = {
    opened: totals.opened as number,
    merged: totals.merged as number,
    reverts: totals.reverts as number,
    perDay: perDay as Facts["perDay"],
    cycle: cycle as Facts["cycle"],
    interactions: {
      perPullRequest: totals.interactions as number | null,
      perDay: interactionsPerDay as Facts["interactions"]["perDay"],
    },
    runs: {
      total: runs.total as number,
      topLevel: runs.topLevel as number,
      byAgent: byAgent as Facts["runs"]["byAgent"],
    },
    hours: runs.hours as number,
    spend: {
      total: spend.total as number,
      unattributed: spend.unattributed as number,
      bySource: await slice("source"),
      byUser: await slice("user_id"),
      byAgent: await slice("agent"),
      byModel: await slice("model"),
    },
    top: top as Facts["top"],
  };
  const built = buildReport(facts, options);
  writeText(files.out, `${JSON.stringify(built, null, 2)}\n`);
  const written = [files.out];
  if (files.markdown) {
    writeText(files.markdown, markdown(built));
    written.push(files.markdown);
  }
  return [summary(built), `wrote ${written.join(" and ")}`];
}
