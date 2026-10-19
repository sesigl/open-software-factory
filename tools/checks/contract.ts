// CONTRACT: no breaking change to a schema or API without a major version, and every fixture agrees with its
// schema. The base is the last `contracts-v*` release tag, else OSF_BASE. JSON Schemas go through the same diff as
// `osf-contracts breaking`; OpenAPI files go through oasdiff.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import picomatch from "picomatch";
import type { Context } from "./lib/context.ts";
import { filesAt, lastTag, showAt } from "./lib/git.ts";
import type { Finding } from "./lib/repo.ts";
import { findTool } from "./lib/tools.ts";

const RELEASE_TAGS = "contracts-v*";
const SCHEMAS = "contracts/**/*.schema.json";
const NOT_SCHEMAS = ["**/node_modules/**", "**/fixtures/**"];

export async function contract(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const findings: Finding[] = [...fixtures(context)];
  const isSchema = picomatch(SCHEMAS, { dot: true, ignore: NOT_SCHEMAS });
  const schemas = repo.match(SCHEMAS).filter((file) => isSchema(file));
  const apis = repo.match("contracts/**/openapi.{yaml,yml,json}");
  if (schemas.length + apis.length === 0) return findings;
  const tag = lastTag(repo.root, RELEASE_TAGS);
  const base = tag ?? context.base("CONTRACT");
  if (!base) return findings;
  const released = filesAt(repo.root, base).filter((file) => isSchema(file));
  const since = tag ?? process.env.OSF_BASE?.trim() ?? base;

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
      message: `breaking change since ${since} without a major version (${versions} in ${manifestOf(file)}): ${changes.join("; ")}`,
    });
  };

  // The diff of `osf-contracts breaking`, loaded only here: it needs the built package (contracts/dist).
  let breakingChanges: typeof import("@osf/contracts").breakingChanges;
  try {
    ({ breakingChanges } = await import("@osf/contracts"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    findings.push({ check: "CONTRACT", message: `@osf/contracts is not built (run make verify): ${reason}` });
    return findings;
  }
  const current = new Set(schemas);
  for (const file of released) {
    const before = JSON.parse(showAt(repo.root, base, file) ?? "{}");
    report(file, current.has(file) ? breakingChanges(before, JSON.parse(repo.read(file))) : ["removed the format"]);
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

/** Fixtures in `<dir>/fixtures/valid|invalid/*.json` against the one schema in `<dir>`, formats included. */
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
    addFormats.default(ajv);
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
