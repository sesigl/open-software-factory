// The report as one HTML page: a dashboard without server, database, scripts or network (ADR 0044).
import { hours, percent, type Report, type Slice, usd } from "./report.ts";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Text and attribute values from the forge, like titles, never become markup. */
const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (char) => ENTITIES[char] as string);

const STYLE = `
:root { --bg: #f7f7f5; --panel: #ffffff; --text: #1f2328; --muted: #59636e; --line: #d8dee4; --bar: #2f6fdb; --bar2: #8a9bb3; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0f1115; --panel: #181b21; --text: #e6e8eb; --muted: #9aa4af; --line: #2c313a; --bar: #6ea2ff; --bar2: #56637a; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 24px; margin: 0; } h2 { font-size: 17px; margin: 32px 0 8px; } h3 { font-size: 15px; margin: 16px 0 6px; }
.muted { color: var(--muted); margin: 4px 0 0; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 20px; }
.tile { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
.tile span { display: block; color: var(--muted); font-size: 13px; }
.tile strong { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px 24px; align-items: start; }
table { width: 100%; border-collapse: collapse; background: var(--panel); font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); overflow-wrap: break-word; }
td + td { white-space: nowrap; }
th { color: var(--muted); font-weight: 600; font-size: 13px; }
a { color: var(--bar); }
svg { width: 100%; height: 140px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
rect { fill: var(--bar); } rect.merged { fill: var(--bar2); }
`;

const table = (head: string[], rows: string[][]): string =>
  `<table><tr>${head.map((cell) => `<th>${esc(cell)}</th>`).join("")}</tr>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</table>`;

/** Rows of a label and a value, both text. */
const facts = (rows: [string, unknown][]): string =>
  table(
    ["Measure", "Value"],
    rows.map(([label, value]) => [esc(label), esc(value)]),
  );

const tile = (label: string, value: string): string =>
  `<div class="tile"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;

const slices = (title: string, list: Slice[]): string =>
  `<div><h3>By ${title}</h3>${table(
    [title, "Spend", "Share"],
    list.map((slice) => [esc(slice.name), esc(usd(slice.usd)), esc(percent(slice.share))]),
  )}</div>`;

/** Bars of the pull requests opened per day, with the merged ones next to them. */
function chart(days: Report["pullRequests"]["perDay"]): string {
  const most = Math.max(1, ...days.map((day) => Math.max(day.opened, day.merged)));
  const width = 1000 / Math.max(days.length, 1);
  const bars = days.map((day, index) => {
    const height = (count: number) => Math.round((count / most) * 120);
    const x = index * width;
    return `<rect x="${x}" y="${130 - height(day.opened)}" width="${width / 2}" height="${height(day.opened)}"><title>${esc(
      `${day.date}: ${day.opened} opened, ${day.merged} merged`,
    )}</title></rect><rect class="merged" x="${x + width / 2}" y="${130 - height(day.merged)}" width="${width / 2}" height="${height(day.merged)}"></rect>`;
  });
  return `<svg viewBox="0 0 1000 130" preserveAspectRatio="none" role="img" aria-label="Pull requests opened and merged per day">${bars.join("")}</svg>`;
}

export function page(report: Report): string {
  const { since, until } = report.period;
  const cost = report.costPerPullRequest;
  const cycle = report.cycleTime;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ledger dashboard</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Ledger dashboard</h1>
<p class="muted">${esc(since ?? "start")} to ${esc(until ?? "end")}. The split below is per pull request.</p>
<div class="tiles">
${tile("Cost per pull request", usd(cost?.usd))}
${tile("Inference", usd(cost?.inference))}
${tile("Compute", usd(cost?.compute))}
${tile("Platform", usd(cost?.platform))}
${tile("Gap to target", usd(cost?.gap))}
${tile("Revert rate", percent(report.revertRate.rate))}
</div>
<h2>Throughput</h2>
<div class="grid">
${facts([
  ["Pull requests opened", report.pullRequests.opened],
  ["Pull requests merged", report.pullRequests.merged],
  ["Human interactions per pull request", report.humanInteractions.perPullRequest ?? "-"],
  ["Runs", report.runs.total],
  ["Top-level runs", report.runs.topLevel],
])}
${table(
  ["Agent", "Runs", "Top-level"],
  report.runs.byAgent.map((agent) => [esc(agent.agent), esc(agent.total), esc(agent.topLevel)]),
)}
</div>
<h3>Opened and merged per day</h3>
${chart(report.pullRequests.perDay)}
<h2>Cycle time</h2>
${facts([
  ["Kickoff to pull request", hours(cycle.kickoffToPullRequest)],
  ["Kickoff to merge", hours(cycle.kickoffToMerge)],
  ["Pull request to first human review", hours(cycle.pullRequestToFirstHumanReview)],
  ["First human review to merge", hours(cycle.firstHumanReviewToMerge)],
])}
<h2>Most expensive pull requests</h2>
${table(
  ["Pull request", "Cost"],
  report.topPullRequests.map((pr) => [`<a href="${esc(pr.url)}">${esc(pr.title)}</a>`, esc(usd(pr.usd))]),
)}
<h2>Spend</h2>
${facts([
  ["Total", usd(report.spend.total)],
  ["Unattributed", usd(report.spend.unattributed)],
])}
<div class="grid">
${slices("source", report.spend.bySource)}
${slices("user", report.spend.byUser)}
${slices("agent", report.spend.byAgent)}
${slices("model", report.spend.byModel)}
</div>
</main>
</body>
</html>
`;
}
