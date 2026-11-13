// The records of the attached gateways in the adapter's data folder, OSF_DATA. A record names the proxy and the
// variable of its master key, never the key's value. A second file keeps the hashed tokens of the run keys that the
// gateway made, one per line with the run's ID, so that stop can delete them and spend-log can show only their calls.
// A third file keeps the runs whose key revoke deleted, so that stop does not delete it again (ADR 0108).
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunningProxy } from "../domain/config.ts";

export interface AttachedGateway extends RunningProxy {
  id: string;
}

const folder = (): string => join(process.env.OSF_DATA ?? ".inference-litellm", "gateways");
const recordFile = (id: string): string => join(folder(), `${id}.json`);
const keysFile = (id: string): string => join(folder(), `${id}.keys`);
const revokedFile = (id: string): string => join(folder(), `${id}.revoked`);
const lines = (file: string): string[] =>
  existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];

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

export function addToken(id: string, token: string, run: string): void {
  appendFileSync(keysFile(id), `${token} ${run}\n`);
}

/** The hashed tokens of the run keys the gateway made, of every run or of one, with the runs whose key is revoked. */
export function tokens(id: string, run?: string, live = false): string[] {
  const revoked = new Set(live ? lines(revokedFile(id)) : []);
  return lines(keysFile(id))
    .map((line) => line.split(" "))
    .filter(([, owner]) => (run === undefined || owner === run) && !revoked.has(owner as string))
    .map(([token]) => token as string);
}

/** Notes that revoke deleted the run's key. */
export function addRevoked(id: string, run: string): void {
  appendFileSync(revokedFile(id), `${run}\n`);
}

/** Removes the record, which must exist, and the files of its tokens and revoked runs, if any. */
export function removeRecord(id: string): void {
  rmSync(recordFile(id));
  rmSync(keysFile(id), { force: true });
  rmSync(revokedFile(id), { force: true });
}
