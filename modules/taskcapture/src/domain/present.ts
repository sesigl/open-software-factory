// The report for people: the output lines, Markdown with --markdown and a Vega-Lite chart with --chart.
import { type Cell, type CellRef, cellName, type Report } from "./cells.ts";

export const percent = (share: number | null): string => (share === null ? "unknown" : `${(share * 100).toFixed(1)}%`);
export const usd = (amount: number | null): string => (amount === null ? "unknown" : amount.toFixed(2));
const named = (cell: CellRef | null): string => (cell ? cellName(cell) : "none");

/** One warning per incomplete cell and per cell with trials without a cost. */
function warnings(cell: Cell): string[] {
  return [
    ...(cell.incomplete
      ? [`${cellName(cell)}: correctness uses ${cell.scoredTasks} of ${cell.tasks} tasks; rerun with: ${cell.resume}`]
      : []),
    ...(cell.trialsWithoutCost
      ? [`${cellName(cell)}: ${cell.trialsWithoutCost} of ${cell.trials} trials have no cost`]
      : []),
  ];
}

const picks = (report: Report) => [
  ["Best", named(report.best)],
  ["Lowest cost", named(report.lowestCost)],
  ["Most efficient", named(report.mostEfficient)],
];

export function summaryLines(report: Report): string[] {
  return [
    ...report.cells.map(
      (cell) =>
        `${cellName(cell)}: correctness ${percent(cell.correctness)}, ${usd(cell.costUsdPerTrial)} USD per trial, ${cell.scoredTasks} of ${cell.tasks} tasks scored`,
    ),
    ...report.cells.flatMap(warnings),
    picks(report)
      .map(([label, name]) => `${(label as string).toLowerCase()}: ${name}`)
      .join("; "),
  ];
}

export function markdown(report: Report): string {
  const lines = [
    "# Benchmark report",
    "",
    `${report.tasks.length} tasks, ${report.cells.length} cells of configuration and model.`,
    "",
    "| Configuration | Model | Correctness | USD per trial | Tasks scored |",
    "| --- | --- | --- | --- | --- |",
    ...report.cells.map(
      (cell) =>
        `| ${cell.configuration} | ${cell.model} | ${percent(cell.correctness)} | ${usd(cell.costUsdPerTrial)} | ${cell.scoredTasks} of ${cell.tasks} |`,
    ),
    "",
    ...picks(report).map(([label, name]) => `${label}: ${name}  `),
  ];
  const warned = report.cells.flatMap(warnings);
  if (warned.length) lines.push("", "## Warnings", "", ...warned.map((warning) => `- ${warning}`));
  return `${lines.join("\n")}\n`;
}

/** A Vega-Lite point chart: average cost per trial on x, correctness on y, one point per cell. */
export function chart(report: Report): object {
  const front = new Set(report.paretoFront.map(cellName));
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: "Correctness against average cost per trial",
    data: {
      values: report.cells.map((cell) => ({
        cell: cellName(cell),
        configuration: cell.configuration,
        model: cell.model,
        correctness: cell.correctness,
        costUsdPerTrial: cell.costUsdPerTrial,
        paretoFront: front.has(cellName(cell)),
      })),
    },
    mark: { type: "point", filled: true, size: 120, tooltip: true },
    encoding: {
      x: { field: "costUsdPerTrial", type: "quantitative", title: "Average cost per trial (USD)" },
      y: { field: "correctness", type: "quantitative", title: "Correctness", axis: { format: "%" } },
      color: { field: "model", type: "nominal" },
      shape: { field: "configuration", type: "nominal" },
    },
  };
}
