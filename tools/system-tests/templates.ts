// Astro templates of the TEMPLATE and DUP scenarios (ADR 0132), in the module demo with its layers.
type Sut = { files: { put(path: string, content: string): Promise<unknown> } };

export const TEMPLATE_FILE = "modules/demo/src/web/pages/runs.astro";

const LAYERS = {
  layers: [
    { name: "commands", paths: ["src/commands/"] },
    { name: "templates", paths: ["src/web/"] },
    { name: "pages", paths: ["src/pages/"] },
  ],
};

/** A template whose frontmatter holds `head` and whose markup is `body`. */
export const templateOf = (head: string[], body: string[]): string => ["---", ...head, "---", ...body, ""].join("\n");

/** The frontmatter of a template that shows its route's data: a component, a type, the page's data and its status. */
export const SHOWS = [
  'import type { RunsData } from "../../pages/runs.ts";',
  'import Frame from "../components/Frame.astro";',
  "const { frame, runs } = Astro.locals.page as RunsData;",
  "Astro.response.status = Astro.locals.status;",
];

/** Markup that reads properties, maps a list and switches on a value. */
export const READS = [
  "<Frame frame={frame}>",
  "  <ul>{runs.map((run) => <li><a href={run.href}>{run.title}</a>{run.late ? <b>late</b> : null}</li>)}</ul>",
  "</Frame>",
];

/** Puts the module demo with its layers and this template. */
export async function putTemplate(sut: Sut, template: string, file = TEMPLATE_FILE): Promise<void> {
  await sut.files.put("$INPUT/modules/demo/package.json", '{ "name": "@opensoftware/demo" }\n');
  await sut.files.put("$INPUT/modules/demo/architecture.json", `${JSON.stringify(LAYERS)}\n`);
  await sut.files.put(`$INPUT/${file}`, template);
}
