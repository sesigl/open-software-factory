// Files: the input files and folders, and the report files.
import { readFileSync } from "node:fs";
import { check, readInputs } from "@opensoftware/cli";

/** Each object of the files and folders named, with "<file>:<line>". A folder gives every .json and .jsonl file below it. */
export function readObjects(paths: string[]): { where: string; value: unknown }[] {
  check(paths.length, "name at least one file or folder to ingest");
  return readInputs(paths, /\.jsonl?$/).flatMap(({ file, text }) => objectsOf(file, text));
}

/** One JSON value (an object, or an array of objects) or JSON Lines. */
function objectsOf(file: string, text: string): { where: string; value: unknown }[] {
  try {
    const whole: unknown = JSON.parse(text);
    return (Array.isArray(whole) ? whole : [whole]).map((value) => ({ where: `${file}:1`, value }));
  } catch {
    return text.split("\n").flatMap((line, index) => {
      return line.trim() ? [{ where: `${file}:${index + 1}`, value: parseLine(line) }] : [];
    });
  }
}

/** A JSON line's value; a line that is not JSON gives undefined, which no record kind accepts. */
function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

/** The JSON value of one file, like a LiteLLM price table; undefined when it is not JSON. */
export function readJson(file: string): unknown {
  const [input] = readInputs([file], /\.json$/);
  try {
    return JSON.parse(input?.text ?? "");
  } catch {
    return undefined;
  }
}

/** A file the package ships, like grafana/ledger-dashboard.json, next to dist/. */
export function packageFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}
