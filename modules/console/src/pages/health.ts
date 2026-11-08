// The health page "/health": what `console doctor` finds, one row per check with what to do when it fails (ADR 0086).
import type { Item } from "../domain/doctor.ts";
import { html } from "./html.ts";

export function healthPage(items: Item[]) {
  return html`<h1>Health</h1>
    <table>
      <thead>
        <tr>
          <th>Check</th>
          <th>State</th>
          <th>What to do</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(
          ({ name, ok, detail }) => html`<tr>
            <td>${name}</td>
            <td>${ok ? "ok" : "failing"}</td>
            <td>${ok ? "—" : detail}</td>
          </tr>`,
        )}
      </tbody>
    </table>`;
}
