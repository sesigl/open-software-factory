// The page frame: Preact components written with htm, rendered to HTML on the server (ADR 0072). No script runs in
// the browser; the runs pages reload themselves.
import { html } from "htm/preact";
import type { VNode } from "preact";
import { renderToString } from "preact-render-to-string";
import type { NamedLink } from "../domain/runs.ts";

export { html };

export interface Frame {
  title: string;
  links: NamedLink[];
  /** Seconds after which the browser reloads the page. */
  refresh?: number;
  notes?: string[];
}

/** The whole document: head, the navigation with the dashboards, the notes, and the page's content. */
export function page(frame: Frame, content: VNode | VNode[]): string {
  const body = html`<html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      ${frame.refresh ? html`<meta http-equiv="refresh" content=${String(frame.refresh)} />` : null}
      <title>${frame.title} · console</title>
      <link rel="stylesheet" href="/pico.css" />
    </head>
    <body>
      <header class="container">
        <nav>
          <ul>
            <li><strong>console</strong></li>
            <li><a href="/">Runs</a></li>
            <li><a href="/factory">Factory</a></li>
          </ul>
          <ul>
            ${frame.links.map((link) => html`<li><a href=${link.url}>${link.name}</a></li>`)}
          </ul>
        </nav>
      </header>
      <main class="container">
        ${(frame.notes ?? []).map((note) => html`<p role="alert">${note}</p>`)} ${content}
      </main>
    </body>
  </html>`;
  return `<!doctype html>${renderToString(body)}`;
}

/** A link, or a dash when there is no URL. */
export const linkOr = (url: string | undefined, text: string) => (url ? html`<a href=${url}>${text}</a>` : "—");

/** The content of a page for a request the console cannot answer, with the reason. */
export const problem = (title: string, detail: string) => html`<h1>${title}</h1>
  <p>${detail}</p>`;
