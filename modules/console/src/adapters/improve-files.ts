// The files of the improvement jobs (ADR 0123): every JSON value or JSON line of the .json and .jsonl files below
// the folder. A line that is no JSON is skipped, as a file that a job is still writing ends in half a line.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Improvement, improvementOf } from "../domain/improvement.ts";

function parsed(text: string): unknown[] {
  try {
    return [JSON.parse(text)];
  } catch {
    return [];
  }
}

export function readImprovement(folder: string): Improvement {
  const files = (readdirSync(folder, { recursive: true }) as string[]).filter((name) => /\.jsonl?$/.test(name));
  const records = files.flatMap((name) => {
    const text = readFileSync(join(folder, name), "utf8");
    return name.endsWith(".jsonl") ? text.split("\n").flatMap(parsed) : parsed(text);
  });
  return improvementOf(records);
}
