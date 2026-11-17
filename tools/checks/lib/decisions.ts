// The records of docs/decisions/: their front matter, their topics and the index that make docs writes (ADR 0161).
import { posix } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Repo } from "./repo.ts";

/** The YAML front matter of a Markdown file, or an empty object. */
export function frontMatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return {};
  try {
    return (parseYaml(match[1] as string) as Record<string, unknown> | null) ?? {};
  } catch {
    return {};
  }
}

/** The topics of a record (ADR 0161), in the order of the index; design notes are the records of test and CI mechanics. */
export const ADR_TOPICS: Record<string, string> = {
  process: "How this repository works",
  stack: "Languages, stack and storage",
  packages: "Modules, packages and releases",
  testing: "Testing",
  ports: "Ports and adapters",
  tools: "The tools",
  factory: "The factory definition, agents and skills",
  runs: "Runs of the foreman",
  console: "The console",
  install: "The Compose profile and the Helm chart",
  "design-note": "Design notes: test and CI mechanics",
};
export const TOPIC_NAMES = Object.keys(ADR_TOPICS);
export const TOPIC_LIST = `${TOPIC_NAMES.slice(0, -1).join(", ")} or ${TOPIC_NAMES.at(-1)}`;
export const DECISIONS_DIR = "docs/decisions";
export const ADR_FILES = `${DECISIONS_DIR}/[0-9][0-9][0-9][0-9]-*.md`;

/** The index of docs/decisions/README.md: the records by topic, then the superseded, rejected and deprecated ones. */
export function decisionIndex(repo: Repo): string {
  const groups = new Map<string, string[]>([...TOPIC_NAMES, "gone"].map((topic) => [topic, []]));
  for (const file of repo.match(ADR_FILES)) {
    const text = repo.read(file);
    const meta = frontMatter(text);
    const status = String(meta.status ?? "").trim();
    const title = /^# \d{4}\. (.+)$/m.exec(text)?.[1]?.trim() ?? "(no title)";
    const name = posix.basename(file);
    const [state = "", ...note] = status.split(";");
    const lasts = state.trim() === "accepted" || state.trim() === "proposed";
    const shown = lasts ? note.join(";").trim() : status;
    const line = `- [${name.slice(0, 4)}](${name}) ${title}${shown ? ` — ${shown}` : ""}`;
    groups.get(lasts ? String(meta.topic ?? "") : "gone")?.push(line);
  }
  const heading = (topic: string): string => ADR_TOPICS[topic] ?? "Superseded, rejected and deprecated";
  return [...groups]
    .filter(([, lines]) => lines.length > 0)
    .map(([topic, lines]) => [`### ${heading(topic)}`, "", ...lines.sort()].join("\n"))
    .join("\n\n");
}
