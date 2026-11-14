// TEMPLATE: an Astro template shows the data its route computed and computes nothing itself (ADR 0132). REACH and
// MUTATION count the logic in `.ts` files only, so a template may hold no logic: its frontmatter holds imports of
// components, type imports and the page's data, and an expression of its markup reads a property, loops over a list
// with `map` or switches on a value. A type import stays in its unit and in a layer at or below the template's.
import { posix } from "node:path";
import { parse } from "@astrojs/compiler-rs";
import type { Context } from "./lib/context.ts";
import type { Finding, Repo } from "./lib/repo.ts";

const ID = "TEMPLATE";
const TEMPLATES = ["modules/*/src/**/*.astro", "packages/*/src/**/*.astro", "adapters/*/*/src/**/*.astro"];

// The parser's tree: ESTree with JSX, the frontmatter as a Program.
interface AstNode {
  type: string;
  start: number;
  [key: string]: unknown;
}

const node = (value: unknown): AstNode | undefined =>
  value && typeof value === "object" && "type" in value ? (value as AstNode) : undefined;

/** `Astro.<a>.<b>` as text, or undefined for anything else. */
function astroPath(value: unknown): string | undefined {
  const found = node(value);
  if (!found) return undefined;
  if (found.type === "Identifier") return String(found.name);
  if (found.type !== "MemberExpression" || found.computed) return undefined;
  const object = astroPath(found.object);
  const property = node(found.property);
  return object && property?.type === "Identifier" ? `${object}.${String(property.name)}` : undefined;
}

const unwrap = (value: unknown): AstNode | undefined => {
  const found = node(value);
  if (found && (found.type === "TSAsExpression" || found.type === "ParenthesizedExpression"))
    return unwrap(found.expression);
  return found;
};

/** A path of properties: `item.name`, `frame.links`, without a call or a computed key. */
const isPath = (value: unknown): boolean => {
  const found = unwrap(value);
  if (found?.type === "UnaryExpression" && found.operator === "!") return isPath(found.argument);
  return astroPath(found) !== undefined;
};

/** Whether an expression of the markup only reads, loops or switches; `problems` gets what it computes. */
function reads(value: unknown, problems: AstNode[]): void {
  const found = unwrap(value);
  if (!found) return;
  switch (found.type) {
    case "Identifier":
    case "MemberExpression":
      if (!isPath(found)) problems.push(found);
      return;
    case "Literal":
    case "JSXText":
    case "JSXEmptyExpression":
      return;
    case "JSXElement":
    case "JSXFragment":
      markup(found, problems);
      return;
    case "ConditionalExpression":
      if (!isPath(found.test)) problems.push(found);
      reads(found.consequent, problems);
      reads(found.alternate, problems);
      return;
    case "LogicalExpression":
      if (found.operator !== "&&" || !isPath(found.left)) problems.push(found);
      reads(found.right, problems);
      return;
    case "CallExpression": {
      const callee = node(found.callee);
      const property = node(callee?.property);
      const [callback, ...rest] = (found.arguments as unknown[]) ?? [];
      const arrow = node(callback);
      const params = (arrow?.params as unknown[] | undefined) ?? [];
      const plain = params.every((param) => node(param)?.type === "Identifier");
      if (
        callee?.type !== "MemberExpression" ||
        property?.type !== "Identifier" ||
        property.name !== "map" ||
        !isPath(callee.object) ||
        arrow?.type !== "ArrowFunctionExpression" ||
        arrow.expression !== true ||
        !plain ||
        rest.length > 0
      ) {
        problems.push(found);
        return;
      }
      reads(arrow.body, problems);
      return;
    }
    default:
      problems.push(found);
  }
}

/** The expressions of the elements' attributes and children. */
function markup(value: unknown, problems: AstNode[]): void {
  const found = node(value);
  if (!found) return;
  if (found.type === "JSXExpressionContainer") {
    reads(found.expression, problems);
    return;
  }
  if (found.type === "JSXAttribute") {
    markup(found.value, problems);
    return;
  }
  if (found.type === "JSXSpreadAttribute") {
    problems.push(found);
    return;
  }
  const opening = node(found.openingElement);
  for (const attribute of (opening?.attributes as unknown[]) ?? []) markup(attribute, problems);
  for (const child of (found.children as unknown[]) ?? []) markup(child, problems);
}

/** The statement is an import of a component or of types, the page's data or the page's status. */
function allowed(statement: AstNode): boolean {
  if (statement.type === "ImportDeclaration") {
    const source = String(node(statement.source)?.value ?? "");
    return statement.importKind === "type" || (source.endsWith(".astro") && source.startsWith("."));
  }
  if (statement.type === "VariableDeclaration") {
    const declarations = statement.declarations as AstNode[];
    return (
      statement.kind === "const" &&
      declarations.length === 1 &&
      ["Astro.locals.page", "Astro.props"].includes(astroPath(unwrap(declarations[0]?.init)) ?? "")
    );
  }
  if (statement.type === "ExpressionStatement") {
    const assignment = node(statement.expression);
    const target = astroPath(assignment?.left);
    const source = astroPath(assignment?.right);
    return (
      assignment?.type === "AssignmentExpression" &&
      (target === "Astro.response.status" || target === "Astro.response.statusText") &&
      source === target.replace("response", "locals")
    );
  }
  return false;
}

/** The layers of the unit's architecture.json, top first, each with its paths. */
function layers(repo: Repo, unit: string): { name: string; paths: string[] }[] {
  const file = `${unit}/architecture.json`;
  if (!repo.exists(file)) return [];
  return (JSON.parse(repo.read(file)) as { layers?: { name: string; paths: string[] }[] }).layers ?? [];
}

const layerOf = (all: { paths: string[] }[], path: string): number =>
  all.findIndex((layer) => layer.paths.some((prefix) => path === prefix || path.startsWith(prefix)));

/** A type import stays in its unit and does not reach a layer above the template's. */
function imports(repo: Repo, file: string, unit: string, statement: AstNode): string | undefined {
  if (statement.type !== "ImportDeclaration") return undefined;
  const source = String(node(statement.source)?.value ?? "");
  if (!source.startsWith(".")) return statement.importKind === "type" ? undefined : `imports ${source}`;
  const target = posix.normalize(posix.join(posix.dirname(file), source));
  if (!target.startsWith(`${unit}/`)) return `imports ${source}, which is outside ${unit}`;
  const all = layers(repo, unit);
  const own = layerOf(all, file.slice(unit.length + 1));
  const reached = layerOf(all, target.slice(unit.length + 1));
  if (own >= 0 && reached >= 0 && reached < own)
    return `imports ${source} of the layer ${all[reached]?.name}, above its layer ${all[own]?.name}`;
  return undefined;
}

const unitOf = (file: string): string => file.split("/src/")[0] as string;

export function template(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [];
  for (const file of repo.match(...TEMPLATES)) {
    const text = repo.read(file);
    const at = (offset: number, message: string): void => {
      findings.push({ check: ID, file, line: text.slice(0, offset).split("\n").length, message });
    };
    const { ast } = parse(text) as unknown as { ast: { frontmatter?: { program?: AstNode }; body?: unknown[] } };
    for (const statement of (ast.frontmatter?.program?.body as AstNode[] | undefined) ?? []) {
      if (!allowed(statement))
        at(statement.start, "the frontmatter holds only imports, the page's data and its status: compute in the route");
      const problem = imports(repo, file, unitOf(file), statement);
      if (problem) at(statement.start, problem);
    }
    const problems: AstNode[] = [];
    for (const part of ast.body ?? []) markup(part, problems);
    for (const problem of problems)
      at(problem.start, "the markup computes: an expression reads a property, maps a list or switches on a value");
  }
  return findings;
}
