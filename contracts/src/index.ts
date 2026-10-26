// @opensoftware/contracts: the types of the shared formats and a validator for each. Modules import only from here.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { type Format, formatNamed } from "./formats.ts";
import type { components } from "./generated/types.ts";

export { diff as breakingChanges, type Schema } from "./breaking.ts";
export { FORMATS, type Format, formatNamed } from "./formats.ts";
export type { components, paths } from "./generated/types.ts";
export { type AttributeValue, type RunSpan, runSpans, type SpanAttributes } from "./run-record.ts";

type Schemas = components["schemas"];
export type FactoryDefinition = Schemas["FactoryDefinition"];
export type WorkItem = Schemas["WorkItem"];
export type RunRecord = Schemas["RunRecord"];
export type EvidenceManifest = Schemas["EvidenceManifest"];
export type Score = Schemas["Score"];
export type WorkReceived = Schemas["WorkReceived"];
export type RunStarted = Schemas["RunStarted"];
export type RunCompleted = Schemas["RunCompleted"];
export type GateRequested = Schemas["GateRequested"];
export type GateDecided = Schemas["GateDecided"];
export type ScoreRecorded = Schemas["ScoreRecorded"];
export type PrOpened = Schemas["PrOpened"];
export type PrReviewed = Schemas["PrReviewed"];
export type PrClosed = Schemas["PrClosed"];
export type IssueLabeled = Schemas["IssueLabeled"];
export type GateRecord = Schemas["GateRecord"];
export type GateRequest = Schemas["GateRequest"];
export type GateView = Schemas["GateView"];
export type ApiProblem = Schemas["ApiProblem"];
export type WorkSubmission = Schemas["WorkSubmission"];
export type WorkItemView = Schemas["WorkItemView"];
export type WorkRequest = Schemas["WorkRequest"];
export type RunView = Schemas["RunView"];
export type StageView = Schemas["StageView"];
export type RunSignal = Schemas["RunSignal"];
export type SandboxSpec = Schemas["SandboxSpec"];

/** One reason a document does not match its format. `path` is a JSON Pointer into the document. */
export interface Problem {
  path: string;
  message: string;
}

/** The package root: dist/ and src/ both sit one level below it, next to the schema folders. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const validators = new Map<string, ValidateFunction>();

/** The JSON Schema of a format, as published in `<path>/<name>.schema.json`. */
export function schemaOf(format: Format | string): Record<string, unknown> {
  const found = typeof format === "string" ? formatNamed(format) : format;
  if (!found) throw new Error(`Unknown format: ${String(format)}`);
  return JSON.parse(readFileSync(join(ROOT, found.path, `${found.name}.schema.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

/** Every problem of the document; empty when it matches the format. */
export function validate(format: Format | string, document: unknown): Problem[] {
  const name = typeof format === "string" ? format : format.name;
  let check = validators.get(name);
  if (!check) {
    // strictRequired is off: "exactly one of" rules use `not: { required: [...] }` on purpose.
    const ajv = new Ajv2020.default({ allErrors: true, strict: true, strictRequired: false });
    addFormats.default(ajv);
    check = ajv.compile(schemaOf(format));
    validators.set(name, check);
  }
  return check(document) ? [] : problems(check.errors ?? []);
}

/** True when the document matches the format, with its type narrowed. */
export function isValid<T>(format: Format | string, document: unknown): document is T {
  return validate(format, document).length === 0;
}

const ALTERNATIVES = new Set(["anyOf", "oneOf"]);

/** Ajv errors as one line per problem; the branches of a failed `anyOf` or `oneOf` collapse into one problem. */
function problems(errors: ErrorObject[]): Problem[] {
  const alternatives = errors.filter((error) => ALTERNATIVES.has(error.keyword)).map((error) => error.instancePath);
  const insideAlternative = (error: ErrorObject): boolean =>
    !ALTERNATIVES.has(error.keyword) &&
    /\/(anyOf|oneOf)\//.test(error.schemaPath) &&
    alternatives.some((path) => error.instancePath === path || error.instancePath.startsWith(`${path}/`));
  const seen = new Set<string>();
  const out: Problem[] = [];
  for (const error of errors) {
    if (insideAlternative(error)) continue;
    const problem = describe(error);
    const key = `${problem.path} ${problem.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(problem);
  }
  return out;
}

function describe(error: ErrorObject): Problem {
  const child = (name: string): string => `${error.instancePath}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  switch (error.keyword) {
    case "additionalProperties":
      return { path: child(String(error.params.additionalProperty)), message: "unknown field" };
    case "unevaluatedProperties":
      return { path: child(String(error.params.unevaluatedProperty)), message: "unknown field" };
    case "required":
      return { path: child(String(error.params.missingProperty)), message: "missing required field" };
    case "anyOf":
    case "oneOf":
      return { path: error.instancePath || "/", message: "must match exactly one of the allowed forms" };
    default:
      return { path: error.instancePath || "/", message: error.message ?? error.keyword };
  }
}
