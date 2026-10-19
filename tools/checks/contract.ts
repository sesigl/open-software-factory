// CONTRACT: no breaking change to a schema or API without a major version, and every fixture agrees with its
// schema. JSON Schemas are compared here; OpenAPI files go through oasdiff.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { Context } from "./lib/context.ts";
import { showAt } from "./lib/git.ts";
import type { Finding } from "./lib/repo.ts";
import { findTool } from "./lib/tools.ts";

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: unknown[];
  items?: Schema;
  additionalProperties?: boolean | Schema;
};

export function contract(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [...fixtures(context)];
  const schemas = repo.match("contracts/**/*.schema.json");
  const apis = repo.match("contracts/**/openapi.{yaml,yml,json}");
  if (schemas.length + apis.length === 0) return findings;
  const base = context.base("CONTRACT");
  if (!base) return findings;

  const versionAt = (file: string, at?: string): string | undefined => {
    const manifest = manifestOf(file);
    const text = at ? showAt(repo.root, at, manifest) : repo.exists(manifest) ? repo.read(manifest) : undefined;
    return text ? (JSON.parse(text) as { version?: string }).version : undefined;
  };
  const majorBumped = (file: string): boolean => {
    const before = versionAt(file, base);
    const after = versionAt(file);
    return before !== undefined && after !== undefined && major(after) > major(before);
  };
  const report = (file: string, changes: string[]): void => {
    if (changes.length === 0 || majorBumped(file)) return;
    const versions = `${versionAt(file, base) ?? "?"} → ${versionAt(file) ?? "?"}`;
    findings.push({
      check: "CONTRACT",
      file,
      line: 1,
      message: `breaking change without a major version (${versions} in ${manifestOf(file)}): ${changes.join("; ")}`,
    });
  };

  for (const file of schemas) {
    const before = showAt(repo.root, base, file);
    if (before === undefined) continue;
    report(file, breaking(JSON.parse(before) as Schema, JSON.parse(repo.read(file)) as Schema, ""));
  }

  for (const file of apis) {
    const before = showAt(repo.root, base, file);
    if (before === undefined || before === repo.read(file)) continue;
    const oasdiff = findTool("oasdiff");
    if (!oasdiff) {
      findings.push({ check: "CONTRACT", file, line: 1, message: "oasdiff is not installed: run make tools" });
      continue;
    }
    const temp = mkdtempSync(join(tmpdir(), "osf-contract-"));
    try {
      const old = join(temp, basename(file));
      writeFileSync(old, before);
      const run = spawnSync(oasdiff, ["breaking", old, join(repo.root, file), "--fail-on", "ERR", "--format", "text"], {
        encoding: "utf8",
      });
      if (run.status !== 0) report(file, [run.stdout.trim() || run.stderr.trim()]);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  return findings;
}

/** Changes that make data valid under the old schema invalid, or remove what readers relied on. */
function breaking(before: Schema, after: Schema, path: string): string[] {
  const changes: string[] = [];
  const name = (key: string): string => (path ? `${path}.${key}` : key);
  const types = (schema: Schema): string => [schema.type ?? []].flat().sort().join("|");
  if (before.type !== undefined && types(before) !== types(after)) {
    changes.push(`changed the type of ${path || "the root"} from ${types(before)} to ${types(after) || "any"}`);
  }
  for (const key of Object.keys(before.properties ?? {})) {
    const next = after.properties?.[key];
    if (!next) changes.push(`removed property ${name(key)}`);
    else changes.push(...breaking(before.properties?.[key] as Schema, next, name(key)));
  }
  for (const key of after.required ?? []) {
    if (!(before.required ?? []).includes(key)) changes.push(`made ${name(key)} required`);
  }
  for (const value of before.enum ?? []) {
    if (after.enum && !after.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
      changes.push(`removed the value ${JSON.stringify(value)} from ${path || "the root"}`);
    }
  }
  if (before.additionalProperties !== false && after.additionalProperties === false) {
    changes.push(`closed ${path || "the root"} to additional properties`);
  }
  if (before.items && after.items) changes.push(...breaking(before.items, after.items, `${path}[]`));
  return changes;
}

/** Fixtures in `<dir>/fixtures/valid|invalid/*.json` against the one schema in `<dir>`. */
function fixtures(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [];
  for (const fixture of repo.match("contracts/**/fixtures/{valid,invalid}/*.json")) {
    const kind = basename(dirname(fixture));
    const dir = dirname(dirname(dirname(fixture)));
    const schemas = repo.match(`${dir}/*.schema.json`);
    if (schemas.length !== 1) {
      const message = `needs exactly one *.schema.json in ${dir}/, found ${schemas.length}`;
      findings.push({ check: "CONTRACT", file: fixture, line: 1, message });
      continue;
    }
    const ajv = new Ajv2020.default({ strict: false, allErrors: true });
    const validate = ajv.compile(JSON.parse(repo.read(schemas[0] as string)) as object);
    const valid = validate(JSON.parse(repo.read(fixture)));
    if (kind === "valid" && !valid) {
      const errors = ajv.errorsText(validate.errors);
      findings.push({
        check: "CONTRACT",
        file: fixture,
        line: 1,
        message: `does not validate against ${schemas[0]}: ${errors}`,
      });
    }
    if (kind === "invalid" && valid) {
      findings.push({
        check: "CONTRACT",
        file: fixture,
        line: 1,
        message: `validates against ${schemas[0]} but should not`,
      });
    }
  }
  return findings;
}

function manifestOf(file: string): string {
  return `${file.split("/")[0]}/package.json`;
}

function major(version: string): number {
  return Number(version.split(".")[0]);
}
