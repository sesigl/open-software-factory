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
  /** Whether the navigation links the inbox: only when it has a repository. */
  inbox?: boolean;
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
            ${frame.inbox ? html`<li><a href="/inbox">Inbox</a></li>` : null}
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

/** A link to an http or https URL; any other URL, such as "javascript:", gives the text, and no URL a dash. */
export const linkOr = (url: string | undefined, text: string) => {
  if (!url) return "—";
  return /^https?:\/\//i.test(url) ? html`<a href=${url}>${text}</a>` : text;
};

/** The content of a page for a request the console cannot answer, with the reason. */
export const problem = (title: string, detail: string) => html`<h1>${title}</h1>
  <p>${detail}</p>`;
