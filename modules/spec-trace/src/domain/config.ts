// spec-trace.json: every key is optional; the defaults fit a repository with feature files and `*.test.ts` tests.
import type { Config, Prefix } from "./model.ts";

export const DEFAULTS = {
  features: ["**/*.feature"],
  tests: ["**/*.test.ts"],
  junit: "reports/junit",
  id: "^SCN-([A-Z][A-Z0-9]*)-\\d{3}$",
  function: "scenario",
};

type Raw = Record<string, unknown>;

const isString = (value: unknown): value is string => typeof value === "string" && value !== "";
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const isGlobs = (value: unknown): boolean => Array.isArray(value) && value.length > 0 && value.every(isString);

const KEYS: Record<string, { valid: (value: unknown) => boolean; expected: string }> = {
  features: { valid: isGlobs, expected: "a list of globs" },
  tests: { valid: isGlobs, expected: "a list of globs" },
  junit: { valid: isString, expected: "a folder" },
  id: { valid: isString, expected: "a regular expression" },
  function: { valid: isString, expected: "a function name" },
  testFolder: { valid: isString, expected: "a folder name" },
  prefixes: {
    valid: (value) => isString(value) || (isObject(value) && Object.values(value).every(isString)),
    expected: "a Markdown file or an object of prefix and folder",
  },
  conformance: {
    valid: (value) => isObject(value) && ["tag", "ports", "adapters"].every((key) => isString(value[key])),
    expected: "an object with tag, ports and adapters",
  },
};

export interface Settings {
  config: Config;
  /** A Markdown file whose table registers the prefixes; the command reads it. */
  prefixFile: string | undefined;
}

/** Throws with `<source>: <problem>` when a key is unknown or has the wrong type. */
export function settings(raw: unknown, source: string): Settings {
  if (!isObject(raw)) throw new Error(`${source}: must be a JSON object`);
  for (const [key, value] of Object.entries(raw)) {
    const rule = KEYS[key];
    if (!rule) throw new Error(`${source}: unknown key "${key}"; known: ${Object.keys(KEYS).join(", ")}`);
    if (!rule.valid(value)) throw new Error(`${source}: "${key}" must be ${rule.expected}`);
  }
  const value = { ...DEFAULTS, ...raw } as typeof DEFAULTS & Raw;
  const prefixes = isObject(value.prefixes)
    ? new Map(Object.entries(value.prefixes).map(([prefix, path]) => [prefix, { path: String(path), source }]))
    : undefined;
  return {
    config: {
      features: value.features,
      tests: value.tests,
      junit: value.junit,
      id: new RegExp(value.id),
      function: value.function,
      prefixes,
      testFolder: value.testFolder as string | undefined,
      conformance: value.conformance as Config["conformance"],
    },
    prefixFile: isString(value.prefixes) ? value.prefixes : undefined,
  };
}

/** Rows of a Markdown table: `| PREFIX | owner | \`path/\` |`. */
export function prefixTable(text: string, file: string): Map<string, Prefix> {
  const prefixes = new Map<string, Prefix>();
  text.split("\n").forEach((row, index) => {
    const match = /^\|\s*([A-Z][A-Z0-9]*)\s*\|[^|]*\|\s*`([^`]+)`\s*\|/.exec(row);
    if (match) prefixes.set(match[1] as string, { path: match[2] as string, source: `${file}:${index + 1}` });
  });
  return prefixes;
}
