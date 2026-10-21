// Helpers of the PostgreSQL and dashboard scenarios (ADR 0035): the README sample, and the SQL of a dashboard panel
// with Grafana's macros filled in, for "ledger query".

/** The JSON Lines of the README's quick start. */
export function readmeSample(fakes: { fromRepository(dir: string): Record<string, string> }): string {
  const readme = fakes.fromRepository("modules/ledger")["README.md"] as string;
  const block = /^```jsonl ledger\.jsonl\n([\s\S]*?)^```$/m.exec(readme)?.[1];
  if (!block) throw new Error("the README has no code block for ledger.jsonl");
  return block;
}

export interface Panel {
  title: string;
  targets: { rawSql: string }[];
}

/** The panels of the dashboard file that "ledger dashboard" wrote. */
export function panels(dashboard: string): Panel[] {
  return (JSON.parse(dashboard) as { panels: Panel[] }).panels;
}

/**
 * A panel's SQL as Grafana's PostgreSQL data source sends it: $__timeFrom() and $__timeTo() become quoted UTC
 * times of the range, and each dashboard variable its value.
 */
export function panelSql(
  panel: Panel,
  range: { from: string; to: string },
  variables: Record<string, string> = { compute_usd_per_hour: "0", platform_usd: "0" },
): string {
  let sql = (panel.targets[0] as { rawSql: string }).rawSql
    .replaceAll("$__timeFrom()", `'${range.from}T00:00:00Z'`)
    .replaceAll("$__timeTo()", `'${range.to}T00:00:00Z'`);
  for (const [name, value] of Object.entries(variables)) sql = sql.replaceAll(`$${name}`, value);
  return sql;
}
