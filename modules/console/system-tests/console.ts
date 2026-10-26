// Shared setup of the console scenarios: runs as the foreman's API shows them, fake foremen, the server, and readers
// of the pages' HTML: their text, table rows and links.
import type { RunView } from "@opensoftware/contracts";
import type { Fakes, Sut } from "@opensoftware/testkit";

export const RUN = "run_5d41402abc4b2a76b971";
export const SLACK_THREAD = "https://acme.slack.com/archives/C0WORK/p1767225600000001";

/** A run of the factory "web", running since five minutes before the testkit's clock, with these fields changed. */
export function runOf(title: string, fields: Partial<RunView> = {}): RunView {
  return {
    runId: RUN,
    workItem: {
      id: "wi_0123456789abcdef0123",
      type: "task",
      title,
      requester: { kind: "person", id: "slack:U0VARUN", displayName: "Varun" },
      origin: { source: "slack", url: SLACK_THREAD },
      dedupeKey: SLACK_THREAD,
    },
    factory: "web",
    factoryVersion: "0a1b2c3",
    state: "running",
    startedAt: "2025-12-31T23:55:00.000Z",
    stages: [],
    ...fields,
  };
}

/** A foreman's API that lists these runs at /v1/runs and shows each at /v1/runs/<runId>. */
export const foreman = (fakes: Fakes, runs: RunView[], more: Parameters<Fakes["http"]>[0] = []) =>
  fakes.http([
    ...more,
    { path: "/v1/runs", body: { runs } },
    ...runs.map((run) => ({ path: `/v1/runs/${run.runId}`, body: run })),
  ]);

/** Starts "console serve" with the foremen at these URLs and these variables. */
export const serving = (sut: Sut, foremen: string[], env: Record<string, string> = {}) =>
  sut.http.start(["serve"], { env: { CONSOLE_FOREMAN_URL: foremen.join(","), ...env } });

/** The page at the path: its status and its HTML. */
export async function open(sut: Sut, path: string): Promise<{ status: number; html: string }> {
  const answer = await sut.http.get(path);
  return { status: answer.status, html: String(answer.body) };
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };
const decode = (text: string) => text.replace(/&(lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity] as string);

/** The visible text of a piece of HTML, with its whitespace collapsed. */
export const text = (html: string): string =>
  decode(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** The rows of the page's table bodies, each as the text of its cells. */
export const rows = (html: string): string[][] =>
  [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].flatMap(([, body]) =>
    [...(body as string).matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
      [...(row as string).matchAll(/<td>([\s\S]*?)<\/td>/g)].map(([, cell]) => text(cell as string)),
    ),
  );

/** The links of a piece of HTML: their target and their text. */
export const links = (html: string): { href: string; text: string }[] =>
  [...html.matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, inner]) => ({
    href: decode(href as string),
    text: text(inner as string),
  }));

/** The HTML of the table row whose first cell holds this text. */
export const rowWith = (html: string, first: string): string =>
  [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map(([row]) => row)
    .find((row) => {
      const cell = /<td>([\s\S]*?)<\/td>/.exec(row);
      return cell !== null && text(cell[1] as string) === first;
    }) ?? "";

/** A factory definition with the agent "triage", as CONSOLE_FACTORY reads it. */
export const FACTORY_YAML = `version: 1
factory: acme
description: The factory of Acme's web shop.
providers:
  harness:
    claude-code: "^2"
agents:
  triage:
    harness: claude-code
    model: routes/triage
    prompt: ./prompts/triage.md
`;

/** Writes the factory definition to $INPUT and gives the variables that name it. */
export async function factoryEnv(sut: Sut): Promise<Record<string, string>> {
  await sut.files.put("$INPUT/factory.yaml", FACTORY_YAML);
  return { CONSOLE_FACTORY: sut.files.path("$INPUT/factory.yaml") };
}
