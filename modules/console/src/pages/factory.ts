// The configuration pages "/factory" and "/factory/agents/<name>": the factory definition, read-only, with the link
// to the file and the branch in Git where it changes (CODE-002).
import { stringify } from "yaml";
import type { Factory } from "../adapters/factory-file.ts";
import { html, linkOr } from "./html.ts";

export interface Source {
  /** The file in the repository's web UI, when CONSOLE_REPOSITORY_URL is set. */
  url?: string;
  path: string;
  branch: string;
}

const where = (source: Source) =>
  html`<p>Read-only. Change it in Git, on the branch ${source.branch}: ${linkOr(source.url, source.path)}</p>`;

export function factoryPage(factory: Factory, source: Source) {
  return html`<h1>${factory.factory}</h1>
    <p>${factory.description}</p>
    ${where(source)}
    <h2>Providers</h2>
    <pre>${stringify(factory.providers ?? {})}</pre>
    <h2>Agents</h2>
    <table>
      <thead>
        <tr>
          <th>Agent</th>
          <th>Harness</th>
          <th>Model</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(factory.agents ?? {}).map(
          ([name, agent]) => html`<tr>
            <td><a href=${`/factory/agents/${name}`}>${name}</a></td>
            <td>${String(agent.harness)}</td>
            <td>${String(agent.model)}</td>
          </tr>`,
        )}
      </tbody>
    </table>`;
}

export function agentPage(name: string, agent: Record<string, unknown>, source: Source) {
  return html`<h1>${name}</h1>
    ${where(source)}
    <dl>
      ${Object.entries(agent).map(
        ([key, value]) => html`<dt>${key}</dt>
          <dd>${typeof value === "object" ? html`<pre>${stringify(value)}</pre>` : String(value)}</dd>`,
      )}
    </dl>`;
}
