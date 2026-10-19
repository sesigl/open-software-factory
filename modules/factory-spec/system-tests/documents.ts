// Finds the parts of the YAML files the module writes, as text, so a test can assert on their lines. System tests
// may not import a YAML parser (BOUNDARY-STATIC), and the module writes YAML with two-space indentation.

/** The YAML document of a multi-document file with this `kind` and `metadata.name`. */
export function resource(text: string, kind: string, name: string): string | undefined {
  return text
    .split(/^---$/m)
    .find((document) => document.includes(`\nkind: ${kind}\n`) && document.includes(`\nmetadata:\n  name: ${name}\n`));
}

/** The frontmatter and the body of a gh-aw workflow file. */
export function workflow(text: string): { frontmatter: string; body: string } {
  const [, frontmatter = "", body = ""] = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(text) ?? [];
  return { frontmatter, body };
}

/** YAML lines from an indented template literal, indented by `depth` levels as they sit in the file. */
export function lines(text: string, depth = 0): string {
  const rows = text
    .replace(/^\n/, "")
    .replace(/\n\s*$/, "")
    .split("\n");
  const indent = Math.min(...rows.filter((row) => row.trim()).map((row) => /^ */.exec(row)?.[0].length ?? 0));
  return rows.map((row) => (row.trim() ? "  ".repeat(depth) + row.slice(indent) : "")).join("\n");
}
