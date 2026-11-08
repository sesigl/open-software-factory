// The records of the attached gateways in the adapter's data folder, OSF_DATA. A record names the proxy and the
// variable of its master key, never the key's value. A second file keeps the hashed tokens of the run keys that the
// gateway made, one per line, so that stop can delete them and spend-log can show only their calls.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunningProxy } from "../domain/config.ts";

export interface AttachedGateway extends RunningProxy {
  id: string;
}

const folder = (): string => join(process.env.OSF_DATA ?? ".inference-litellm", "gateways");
const recordFile = (id: string): string => join(folder(), `${id}.json`);
const keysFile = (id: string): string => join(folder(), `${id}.keys`);

export function saveRecord(record: AttachedGateway): void {
  mkdirSync(folder(), { recursive: true });
  writeFileSync(recordFile(record.id), `${JSON.stringify(record)}\n`);
}

/** The record of the gateway, or undefined when the gateway is not attached. */
export function readRecord(id: string): AttachedGateway | undefined {
  const file = recordFile(id);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as AttachedGateway) : undefined;
}

/** The IDs of the attached gateways. */
export function recordIds(): string[] {
  if (!existsSync(folder())) return [];
  return readdirSync(folder())
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length));
}

export function addToken(id: string, token: string): void {
  appendFileSync(keysFile(id), `${token}\n`);
}

/** The hashed tokens of the run keys the gateway made. */
export function tokens(id: string): string[] {
  const file = keysFile(id);
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
}

/** Removes the record, which must exist, and the file of its tokens, if any. */
export function removeRecord(id: string): void {
  rmSync(recordFile(id));
  rmSync(keysFile(id), { force: true });
}
