// The files gatekeeper reads and writes.
import { existsSync, readFileSync } from "node:fs";
import { UsageError, writeText } from "@opensoftware/cli";

export function readText(file: string): string {
  if (!existsSync(file)) throw new UsageError(`${file} does not exist`);
  return readFileSync(file, "utf8");
}

export function readJson(file: string): unknown {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError(`${file} is not JSON`);
  }
}

export const writeJson = (file: string, value: unknown): void => writeText(file, `${JSON.stringify(value, null, 2)}\n`);
