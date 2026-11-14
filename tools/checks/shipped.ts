// DEPS-RUNTIME: a published package runs only on what it publishes and depends on (ADR 0138). npm installs a package
// with its dependencies, peerDependencies and optionalDependencies, never with its devDependencies. Inside this
// repository every devDependency is installed, so no system test sees a package that the code loads at run time but
// declares only for development: the console 0.8.0 resolved a file of its devDependency @opensoftware/ui and did not
// start when installed from npm.
//
// The code a package ships is the TypeScript sources that its entry points (`bin`, `main`, `exports`) reach through
// relative imports: what Node loads from dist/. No entry point imports a file that a bundler builds, such as an Astro
// template in the console's src/web/: Node cannot load it, and its imports are the bundler's. A package that
// `osf bundle` builds (its build script runs tools/bin/bundle.ts, ADR 0079) holds its imports in the bundle; only its
// lookups by name load from node_modules at run time.
//
// A load is an import or a re-export that compilation keeps (verbatimModuleSyntax erases `import type` and
// `export type`, nothing else), `import("x")`, or a lookup: `require("x")`, `createRequire(...)("x")` and
// `.resolve("x")` of a require or of `import.meta`. Only a string literal names a package.
import { isBuiltin } from "node:module";
import { posix } from "node:path";
import { ts } from "ts-morph";
import type { Context } from "./lib/context.ts";
import type { Finding, Repo } from "./lib/repo.ts";
import { workspace } from "./lib/workspace.ts";

const ID = "DEPS-RUNTIME";

interface Manifest {
  bin?: unknown;
  main?: unknown;
  exports?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface Load {
  specifier: string;
  line: number;
  /** A lookup by name at run time, which a bundler does not compile in, unlike an import. */
  lookup: boolean;
}

/** Every string of a `bin`, `main` or `exports` value, with its conditions and subpaths. */
const targets = (value: unknown): string[] =>
  typeof value === "string" ? [value] : Object.values(value ?? {}).flatMap(targets);

/** The source file of an entry point: `dist/cli.js` is `src/cli.ts`, `bin/x.ts` is itself. */
function sourceOf(repo: Repo, unit: string, target: string): string | undefined {
  const file = posix.normalize(target);
  if (!/\.[cm]?[jt]s$/.test(file)) return undefined;
  const typed = file.replace(/\.([cm]?)js$/, ".$1ts");
  return [typed, typed.replace(/^dist\//, "src/")]
    .map((path) => posix.join(unit, path))
    .find((path) => repo.exists(path));
}

/** The text of a string literal without substitutions, or undefined. */
const literal = (node: ts.Node | undefined): string | undefined =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;

/** `createRequire(...)` or `module.createRequire(...)`. */
const isCreateRequire = (node: ts.Node): boolean =>
  ts.isCallExpression(node) &&
  ((ts.isIdentifier(node.expression) && node.expression.text === "createRequire") ||
    (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "createRequire"));

/** Every node below `node`. */
function below(node: ts.Node, nodes: ts.Node[] = []): ts.Node[] {
  ts.forEachChild(node, (child) => {
    nodes.push(child);
    below(child, nodes);
  });
  return nodes;
}

/** The loads of one source file. */
function loadsOf(file: string, text: string): Load[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
  const loads: Load[] = [];
  const add = (specifier: ts.Node | undefined, lookup: boolean) => {
    const name = literal(specifier);
    if (specifier === undefined || name === undefined) return;
    loads.push({
      specifier: name,
      line: source.getLineAndCharacterOfPosition(specifier.getStart(source)).line + 1,
      lookup,
    });
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) add(statement.moduleSpecifier, false);
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) add(statement.moduleSpecifier, false);
  }
  const nodes = below(source);
  // A require is `require` or a name that holds the result of `createRequire(...)`.
  const requires = new Set(["require"]);
  for (const node of nodes) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isCreateRequire(node.initializer)
    )
      requires.add(node.name.text);
  }
  const isRequire = (node: ts.Node) => isCreateRequire(node) || (ts.isIdentifier(node) && requires.has(node.text));
  for (const call of nodes.filter(ts.isCallExpression)) {
    const callee = call.expression;
    if (callee.kind === ts.SyntaxKind.ImportKeyword) add(call.arguments[0], false);
    else if (isRequire(callee)) add(call.arguments[0], true);
    else if (ts.isPropertyAccessExpression(callee) && callee.name.text === "resolve") {
      if (isRequire(callee.expression) || ts.isMetaProperty(callee.expression)) add(call.arguments[0], true);
    }
  }
  return loads;
}

/** `@scope/name/file` is the package `@scope/name`; `name/file` is `name`. */
const packageOf = (specifier: string): string =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

export function depsRuntime(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [];
  for (const unit of workspace(repo).filter((unit) => unit.published)) {
    const manifest = JSON.parse(repo.read(`${unit.dir}/package.json`)) as Manifest;
    const bundled = /tools\/bin\/bundle\.ts|osf bundle/.test(manifest.scripts?.build ?? "");
    const installed = new Set([
      unit.name,
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);
    const queue = [manifest.bin, manifest.main, manifest.exports]
      .flatMap(targets)
      .map((target) => sourceOf(repo, unit.dir, target))
      .filter((file): file is string => file !== undefined);
    const reached = new Set(queue);
    for (const file of queue) {
      for (const { specifier, line, lookup } of loadsOf(file, repo.read(file))) {
        if (specifier.startsWith(".")) {
          const next = posix.join(posix.dirname(file), specifier).replace(/\.([cm]?)js$/, ".$1ts");
          if (/\.[cm]?ts$/.test(next) && !reached.has(next) && repo.exists(next)) {
            reached.add(next);
            queue.push(next);
          }
          continue;
        }
        if (isBuiltin(specifier) || (bundled && !lookup)) continue;
        const name = packageOf(specifier);
        if (installed.has(name)) continue;
        const message =
          name in (manifest.devDependencies ?? {})
            ? `${name} is only a devDependency, which npm does not install with ${unit.name}: move it to dependencies, or stop loading it at run time`
            : `${name} is no dependency of ${unit.name}: add it to dependencies, or stop loading it at run time`;
        findings.push({ check: ID, file, line, message });
      }
    }
  }
  return findings;
}
