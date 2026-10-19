// `osf-contracts breaking`: schema changes since the last release that make documents valid under the released
// schema invalid, unless the version in contracts/package.json has a new major number.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  additionalProperties?: boolean | Schema;
  unevaluatedProperties?: boolean | Schema;
  pattern?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
}

const RELEASE_TAGS = "contracts-v*";

export function breaking(baseRef: string | undefined): number {
  const root = git(["rev-parse", "--show-toplevel"], process.cwd());
  if (root === undefined) return fail("osf-contracts breaking runs inside a Git repository");
  const base = baseRef ?? git(["tag", "--list", RELEASE_TAGS, "--sort=-v:refname"], root)?.split("\n")[0];
  if (!base) {
    process.stdout.write(`no ${RELEASE_TAGS} release tag: nothing to compare\n`);
    return 0;
  }
  if (git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], root) === undefined) {
    return fail(`${base} is not a commit, tag or branch`);
  }

  const version = (at?: string): string | undefined => {
    const text = at ? git(["show", `${at}:contracts/package.json`], root) : read(join(root, "contracts/package.json"));
    return text ? (JSON.parse(text) as { version?: string }).version : undefined;
  };
  const before = version(base);
  const after = version();
  const major = (value: string | undefined): number => Number(value?.split(".")[0] ?? Number.NaN);
  const allowed = major(after) > major(before);

  const released = (git(["ls-tree", "-r", "--name-only", base, "--", "contracts"], root) ?? "")
    .split("\n")
    .filter(isSchema);
  const current = new Set(schemaFiles(join(root, "contracts")).map((file) => relative(root, file)));
  let failures = 0;
  for (const file of released) {
    const changes = current.has(file)
      ? diff(
          JSON.parse(git(["show", `${base}:${file}`], root) ?? "{}"),
          JSON.parse(readFileSync(join(root, file), "utf8")),
        )
      : ["removed the format"];
    if (changes.length === 0) continue;
    if (allowed) {
      process.stdout.write(
        `${file}: breaking change allowed by the major version ${before} → ${after}: ${changes.join("; ")}\n`,
      );
      continue;
    }
    failures++;
    process.stdout.write(
      `${file}: breaking change since ${base} without a major version (${before ?? "?"} → ${after ?? "?"}): ${changes.join("; ")}\n`,
    );
  }
  if (failures === 0) process.stdout.write(`no breaking change since ${base}\n`);
  return failures === 0 ? 0 : 1;
}

/** Changes that make data valid under `before` invalid under `after`. */
export function diff(before: Schema, after: Schema, path = ""): string[] {
  const changes: string[] = [];
  const at = path || "the root";
  const name = (key: string): string => (path ? `${path}.${key}` : key);
  const types = (schema: Schema): string => [schema.type ?? []].flat().sort().join("|");

  if (before.type !== undefined && types(before) !== types(after)) {
    const widened = types(before) === "integer" && types(after) === "number";
    if (!widened) changes.push(`changed the type of ${at} from ${types(before)} to ${types(after) || "any"}`);
  }
  for (const key of Object.keys(before.properties ?? {})) {
    const next = after.properties?.[key];
    if (!next) changes.push(`removed property ${name(key)}`);
    else changes.push(...diff(before.properties?.[key] as Schema, next, name(key)));
  }
  for (const key of after.required ?? []) {
    if (!(before.required ?? []).includes(key)) changes.push(`made ${name(key)} required`);
  }
  if (after.enum) {
    for (const value of before.enum ?? []) {
      if (!after.enum.some((candidate) => same(candidate, value))) {
        changes.push(`removed the value ${JSON.stringify(value)} from ${at}`);
      }
    }
  }
  if ("const" in after && !("const" in before && same(before.const, after.const))) {
    changes.push(`fixed ${at} to ${JSON.stringify(after.const)}`);
  }
  for (const keyword of ["additionalProperties", "unevaluatedProperties"] as const) {
    const old = before[keyword];
    const next = after[keyword];
    if (old !== false && next === false) changes.push(`closed ${at} to unknown properties`);
    if (typeof old === "object" && typeof next === "object") changes.push(...diff(old, next, name("*")));
  }
  if (before.items && after.items) changes.push(...diff(before.items, after.items, `${path}[]`));
  for (const keyword of ["anyOf", "oneOf"] as const) {
    const old = before[keyword];
    const next = after[keyword];
    if (!old || !next) continue;
    if (next.length < old.length) changes.push(`removed a form of ${at}`);
    old.forEach((form, index) => {
      const replaced = next[index];
      if (replaced) changes.push(...diff(form, replaced, `${path}|${index + 1}`));
    });
  }
  changes.push(...constraints(before, after, at));
  return changes;
}

/** Tighter bounds, a new or changed pattern, a new format. */
function constraints(before: Schema, after: Schema, at: string): string[] {
  const changes: string[] = [];
  const lower = ["minLength", "minimum", "exclusiveMinimum", "minItems", "minProperties"] as const;
  const upper = ["maxLength", "maximum", "exclusiveMaximum", "maxItems", "maxProperties"] as const;
  for (const key of lower) {
    const next = after[key];
    if (next !== undefined && next > (before[key] ?? Number.NEGATIVE_INFINITY))
      changes.push(`raised ${key} of ${at} to ${next}`);
  }
  for (const key of upper) {
    const next = after[key];
    if (next !== undefined && next < (before[key] ?? Number.POSITIVE_INFINITY))
      changes.push(`lowered ${key} of ${at} to ${next}`);
  }
  if (after.pattern !== undefined && after.pattern !== before.pattern) changes.push(`changed the pattern of ${at}`);
  if (after.format !== undefined && after.format !== before.format)
    changes.push(`required the format ${after.format} for ${at}`);
  return changes;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isSchema(file: string): boolean {
  return file.endsWith(".schema.json") && !file.includes("/node_modules/") && !file.includes("/fixtures/");
}

function schemaFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules" || entry === "fixtures" || entry.startsWith(".")) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return schemaFiles(full);
    return isSchema(full) ? [full] : [];
  });
}

function read(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

function git(args: string[], cwd: string): string | undefined {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 2;
}
