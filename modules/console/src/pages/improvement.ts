// @ts-nocheck
// The page "/improvement": cost and scores of the factory's runs, from the improvement jobs' files (ADR 0123).
import { type Improvement, usd } from "../domain/improvement.ts";
import { html } from "./html.ts";

export function improvementPage({ stages, scorers }: Improvement) {
  const runs = new Set(stages.map((stage) => stage.run)).size;
  const total = stages.reduce((sum, stage) => sum + stage.usd, 0);
  return html`<h1>Cost and scores</h1>
    <p>${usd(total)} over ${runs} runs.</p>
    <h2>Scores</h2>
    <table>
      <thead>
        <tr>
          <th>Scorer</th>
          <th>Scored</th>
          <th>Passed</th>
          <th>Pass rate</th>
          <th>Judge cost</th>
        </tr>
      </thead>
      <tbody>
        ${scorers.map(
          (scorer) => html`<tr>
            <td>${scorer.name}</td>
            <td>${scorer.scored}</td>
            <td>${scorer.passed}</td>
            <td>${Math.round((100 * scorer.passed) / scorer.scored)}%</td>
            <td>${usd(scorer.usd)}</td>
          </tr>`,
        )}
      </tbody>
    </table>
    <h2>Runs</h2>
    <table>
      <thead>
        <tr>
          <th>Run</th>
          <th>Stage</th>
          <th>Outcome</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        ${stages.map(
          (stage) => html`<tr>
            <td><a href=${`/runs/${stage.run}`}>${stage.run}</a></td>
            <td>${stage.stage}</td>
            <td>${stage.outcome}</td>
            <td>${usd(stage.usd)}</td>
          </tr>`,
        )}
      </tbody>
    </table>`;
}
