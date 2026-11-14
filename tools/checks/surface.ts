// SURFACE: every published package has one clear job and a narrow API (owner, 14 November 2026). A library names every
// value its entry points export in the "Public surface" of its AGENTS.md, so its API is that list and grows only by a
// reviewed change to it. Types describe the values and need no entry. An entry point exports by name: `export *` hides
// what it adds.
import { posix } from "node:path";
import { Node, Project } from "ts-morph";
import type { Context } from "./lib/context.ts";
import type { Finding, Repo } from "./lib/repo.ts";

const ID = "SURFACE";
const PACKAGES = [
  "packages/*/package.json",
  "modules/*/package.json",
  "adapters/*/*/package.json",
  "contracts/package.json",
];

/** The source file of each entry point of `package.json`'s exports that is code: `./dist/x.js` is `src/x.ts`. */
function entries(repo: Repo, unit: string, exports: unknown): string[] {
  const targets = typeof exports === "string" ? [exports] : Object.values((exports ?? {}) as Record<string, unknown>);
  const files = targets
    .map((target) => (typeof target === "string" ? target : String((target as Record<string, unknown>)?.default ?? "")))
    .filter((target) => /\.(?:js|ts)$/.test(target) && !target.includes("*"))
    .map((target) => posix.join(unit, target.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts")));
  return [...new Set(files)].filter((file) => repo.exists(file));
}

/** The section "Public surface" of the unit's AGENTS.md, or undefined without one. */
function surfaceOf(repo: Repo, unit: string): string | undefined {
  const file = `${unit}/AGENTS.md`;
  if (!repo.exists(file)) return undefined;
  return /^## Public surface\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(repo.read(file))?.[1];
}

/** The values an entry point exports, each with its line; `export *` gives the name "*". */
function values(file: string, text: string): { name: string; line: number }[] {
  const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(file, text);
  const found: { name: string; line: number }[] = [];
  for (const statement of source.getStatements()) {
    const line = statement.getStartLineNumber();
    if (Node.isExportDeclaration(statement)) {
      if (statement.isTypeOnly()) continue;
      if (!statement.hasNamedExports()) found.push({ name: "*", line });
      for (const named of statement.getNamedExports())
        if (!named.isTypeOnly()) found.push({ name: named.getAliasNode()?.getText() ?? named.getName(), line });
    } else if (Node.isVariableStatement(statement) && statement.isExported()) {
      for (const declaration of statement.getDeclarations()) found.push({ name: declaration.getName(), line });
    } else if (
      (Node.isFunctionDeclaration(statement) ||
        Node.isClassDeclaration(statement) ||
        Node.isEnumDeclaration(statement)) &&
      statement.isExported()
    ) {
      found.push({ name: statement.getName() ?? "default", line });
    }
  }
  return found;
}

export function surface(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [];
  for (const manifest of repo.match(...PACKAGES)) {
    const unit = posix.dirname(manifest);
    if (unit.includes("/_")) continue;
    const files = entries(repo, unit, (JSON.parse(repo.read(manifest)) as { exports?: unknown }).exports);
    if (files.length === 0) continue;
    const listed = surfaceOf(repo, unit);
    for (const file of files) {
      for (const { name, line } of values(file, repo.read(file))) {
        if (name === "*") {
          findings.push({
            check: ID,
            file,
            line,
            message: "export * hides what the library adds: export each value by name",
          });
        } else if (!listed || !new RegExp(`\`${name}(?![\\w])`).test(listed)) {
          findings.push({
            check: ID,
            file,
            line,
            message: `${name} is exported but not named in the "Public surface" of ${unit}/AGENTS.md: name it there, or stop exporting it`,
          });
        }
      }
    }
  }
  return findings;
}
