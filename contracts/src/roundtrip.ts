// `osf-contracts roundtrip --client <client> [dir]`: every valid fixture under dir is loaded by a generated client
// and written back; the result must equal the fixture. TypeScript is the only client (ADR 0012); the flag leaves
// room for another one.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { FORMATS, type Format } from "./formats.ts";
import { validate } from "./index.ts";

export const CLIENTS = ["typescript"] as const;
export type Client = (typeof CLIENTS)[number];

interface Fixture {
  file: string;
  format: Format;
}

export function roundtrip(_client: Client, dir: string): number {
  const fixtures = validFixtures(dir);
  if (fixtures.length === 0) {
    process.stderr.write(`No valid fixtures under ${dir}/<format>/fixtures/valid/\n`);
    return 1;
  }
  let written: Map<string, unknown>;
  try {
    written = viaTypeScript(fixtures);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
  let changed = 0;
  for (const { file } of fixtures) {
    const original: unknown = JSON.parse(readFileSync(file, "utf8"));
    const difference = written.has(file) ? firstDifference(original, written.get(file), "") : "not written back";
    if (difference === undefined) {
      process.stdout.write(`${file}: unchanged\n`);
    } else {
      changed++;
      process.stdout.write(`${file}: changed at ${difference}\n`);
    }
  }
  return changed === 0 ? 0 : 1;
}

function validFixtures(dir: string): Fixture[] {
  const out: Fixture[] = [];
  for (const format of FORMATS) {
    const folder = join(dir, format.path, "fixtures", "valid");
    if (!existsSync(folder) || !statSync(folder).isDirectory()) continue;
    for (const entry of readdirSync(folder).sort()) {
      if (entry.endsWith(".json")) out.push({ file: join(folder, entry).split(sep).join("/"), format });
    }
  }
  return out;
}

/** The TypeScript side: validate, then serialize the typed value again. */
function viaTypeScript(fixtures: Fixture[]): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const { file, format } of fixtures) {
    const document: unknown = JSON.parse(readFileSync(file, "utf8"));
    const problems = validate(format, document);
    if (problems.length > 0)
      throw new Error(`${file} does not match ${format.name}: ${problems[0]?.path} ${problems[0]?.message}`);
    out.set(file, JSON.parse(JSON.stringify(document)));
  }
  return out;
}

/** JSON Pointer and values of the first difference; numbers compare by value, so 4 equals 4.0. */
function firstDifference(a: unknown, b: unknown, path: string): string | undefined {
  if (typeof a === "number" && typeof b === "number") return a === b ? undefined : `${path || "/"}: ${a} → ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path || "/"}: ${a.length} items → ${b.length} items`;
    for (let index = 0; index < a.length; index++) {
      const found = firstDifference(a[index], b[index], `${path}/${index}`);
      if (found) return found;
    }
    return undefined;
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const found = firstDifference(left[key], right[key], `${path}/${key}`);
      if (found) return found;
    }
    return undefined;
  }
  return JSON.stringify(a) === JSON.stringify(b)
    ? undefined
    : `${path || "/"}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`;
}
