// The applied state: what the last "factory apply" rendered, kept in the state folder OSF_DATA (ADR 0020).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface AppliedState {
  /** The resolved definition and the prompt hashes that were applied. */
  model: Record<string, unknown>;
  /** The hash of every rendered file, by its path below the output folder. */
  files: Record<string, string>;
}

const statePath = (): string => join(resolve(process.env.OSF_DATA ?? ".factory"), "state.json");

export function readState(): AppliedState | undefined {
  return existsSync(statePath()) ? (JSON.parse(readFileSync(statePath(), "utf8")) as AppliedState) : undefined;
}

export function writeState(state: AppliedState): void {
  mkdirSync(resolve(process.env.OSF_DATA ?? ".factory"), { recursive: true });
  writeFileSync(statePath(), `${JSON.stringify(state, null, 2)}\n`);
}
