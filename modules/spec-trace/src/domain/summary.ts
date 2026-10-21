// The Markdown summary of a report, for example for the job summary of a workflow run.
import { changeLine } from "./changes.ts";
import { type Report, summary } from "./report.ts";

export function markdown(report: Report): string {
  const lines = ["## spec-trace", "", summary(report), ""];
  const { changes } = report;
  if (changes) {
    const rows = [
      ...changes.added.map((id) => [id, "added"]),
      ...changes.removed.map((id) => [id, "removed"]),
      ...changes.status.map(({ id, from, to }) => [id, `status ${from} → ${to}`]),
      ...changes.steps.map((id) => [id, "steps changed"]),
    ];
    lines.push(`### Changes since \`${changes.base}\``, "", `${changeLine(changes)}.`, "");
    if (rows.length > 0) lines.push(...table(["Scenario", "Change"], rows), "");
  }
  lines.push("### Findings", "");
  if (report.findings.length === 0) lines.push("No findings.", "");
  else {
    const rows = report.findings.map((finding) => [finding.rule, `${finding.file}:${finding.line}`, finding.message]);
    lines.push(...table(["Rule", "Where", "Finding"], rows), "");
  }
  return lines.join("\n");
}

function table(header: string[], rows: string[][]): string[] {
  const row = (cells: string[]): string => `| ${cells.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`;
  return [row(header), row(header.map(() => "---")), ...rows.map(row)];
}
