import type { Repo } from "./repo.ts";

export const PREFIX_FILE = "docs/reference/scenario-prefixes.md";

export interface Prefix {
  prefix: string;
  owner: string;
  path: string;
  line: number;
}

/** Rows of the table in docs/reference/scenario-prefixes.md: `| PREFIX | owner | \`path/\` |`. */
export function loadPrefixes(repo: Repo): Map<string, Prefix> {
  const prefixes = new Map<string, Prefix>();
  if (!repo.exists(PREFIX_FILE)) return prefixes;
  repo
    .read(PREFIX_FILE)
    .split("\n")
    .forEach((row, index) => {
      const match = /^\|\s*([A-Z][A-Z0-9]*)\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/.exec(row);
      if (!match) return;
      const [, prefix = "", owner = "", path = ""] = match;
      prefixes.set(prefix, { prefix, owner, path, line: index + 1 });
    });
  return prefixes;
}
