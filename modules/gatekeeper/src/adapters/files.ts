// The files gatekeeper reads and writes.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/** Writes the delivery to a file of its own for the channel port's receive, runs `work` on it and removes it. */
export async function withDelivery<T>(delivery: unknown, work: (file: string) => Promise<T>): Promise<T> {
  const folder = mkdtempSync(join(tmpdir(), "gatekeeper-"));
  const file = join(folder, "delivery.json");
  try {
    writeFileSync(file, JSON.stringify(delivery), { mode: 0o600 });
    return await work(file);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
