// A scorer file: YAML front matter, then the judge prompt in Markdown (ADR 0032).
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { UsageError } from "./errors.ts";

export interface Scorer {
  name: string;
  description: string;
  /** The pass criterion, one sentence. */
  pass: string;
  /** Share of runs to score, 0 to 1. */
  sample: number;
  /** The judge model, a gateway alias by default. */
  model: string;
  /** USD per million tokens. */
  price?: { input: number; output: number };
  /** Longest transcript the judge gets. */
  maxChars: number;
  /** The judge prompt. */
  prompt: string;
  /** `sha256:` and the first 12 hex digits of the file. */
  version: string;
}

const KEYS = ["name", "description", "pass", "sample", "model", "price", "max_chars"];

export function parseScorer(file: string, fallbackName: string, text: string): Scorer {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new UsageError(`${file}: no front matter between "---" lines`);
  let front: unknown;
  try {
    front = parse(match[1] as string) ?? {};
  } catch (error) {
    throw new UsageError(`${file}: the front matter is not YAML: ${(error as Error).message}`);
  }
  if (typeof front !== "object" || front === null || Array.isArray(front))
    throw new UsageError(`${file}: the front matter is not a mapping`);
  const keys = front as Record<string, unknown>;
  for (const key of Object.keys(keys)) if (!KEYS.includes(key)) throw new UsageError(`${file}: unknown key "${key}"`);
  const fail = (message: string): never => {
    throw new UsageError(`${file}: ${message}`);
  };
  const text_ = (key: string, fallback?: string): string => {
    const value = keys[key] ?? fallback;
    if (typeof value !== "string" || value.trim() === "") return fail(`"${key}" must be a text`);
    return value.trim();
  };
  const name = text_("name", fallbackName);
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(name)) fail(`"name" must be lowercase letters, digits and hyphens`);
  const sample = keys.sample ?? 1;
  if (typeof sample !== "number" || sample < 0 || sample > 1) fail(`"sample" must be a number from 0 to 1`);
  const maxChars = keys.max_chars ?? 200_000;
  if (typeof maxChars !== "number" || !Number.isInteger(maxChars) || maxChars < 200)
    fail(`"max_chars" must be a whole number of at least 200`);
  const price = keys.price;
  if (price !== undefined && !isPrice(price)) fail(`"price" must have the numbers "input" and "output"`);
  const prompt = (match[2] as string).trim();
  if (!prompt) fail("the judge prompt after the front matter is empty");
  return {
    name,
    description: keys.description === undefined ? "" : text_("description"),
    pass: keys.pass === undefined ? fail(`"pass" is required`) : text_("pass"),
    sample: sample as number,
    model: keys.model === undefined ? "judge" : text_("model"),
    price: price as Scorer["price"],
    maxChars: maxChars as number,
    prompt,
    version: `sha256:${createHash("sha256").update(text).digest("hex").slice(0, 12)}`,
  };
}

function isPrice(value: unknown): value is { input: number; output: number } {
  if (typeof value !== "object" || value === null) return false;
  const { input, output, ...rest } = value as Record<string, unknown>;
  return (
    typeof input === "number" && input >= 0 && typeof output === "number" && output >= 0 && !Object.keys(rest).length
  );
}
