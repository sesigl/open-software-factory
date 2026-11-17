// sut.shared: one start of a slow system for the scenarios of a group `@shared=<name>` in a test run (ADR 0157).
// The test processes of the run meet in the run's folder, which the testkit's global setup makes: the first scenario
// of a group that gets the group's folder starts the system, writes its workspace and its result there, and every
// other scenario of the group, in any test process, waits for them. The global setup takes the systems down when the
// run ends, also after a failed start or a failed test.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inject } from "vitest";
import { scenarioShared } from "../support/module.ts";
import { tempFolder } from "../support/temp.ts";
import { composeDown } from "./compose.ts";
import { foldersOf } from "./folders.ts";
import { helmDown } from "./helm.ts";
import type { Sut } from "./sut.ts";

/** What a shared start may use: the files of its workspace and its Compose project and Helm namespace. */
export type SharedSut = Pick<Sut, "files" | "compose" | "helm">;

/** A shared start as a scenario of its group gets it: the group's workspace and what its start returned. */
export interface Shared<T> {
  sut: SharedSut;
  result: T;
}

/** What the global setup gives each test process: the run's folder of shared starts and the run's own process. */
export interface SharedRun {
  dir: string;
  owner: number;
}

declare module "vitest" {
  export interface ProvidedContext {
    osfTestkitShared: SharedRun;
  }
}

/** The kinds of systems a shared start brought up, which the run takes down. */
type Kind = "compose" | "helm";

/**
 * Opens a SharedSut on a group's workspace; `create` makes its folders. `mark` notes a kind of system it brings up;
 * `owner` is the run's process.
 */
export type OpenShared = (workspace: string, create: boolean, owner: number, mark: (kind: Kind) => void) => SharedSut;

/** The start of a group, as its folder holds it for every test process. */
interface Started {
  workspace: string;
  /** The scenario that ran the start. */
  starter: string;
  result?: unknown;
  /** The failure of the start; absent when it succeeded. */
  error?: string;
}

const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** The starts this test process ran or waited for, by group. */
const groups = new Map<string, Promise<Started>>();

export function makeShared(
  moduleRoot: string,
  scenario: string,
  open: OpenShared,
): { shared: Sut["shared"]; used: () => string[] } {
  const used = new Set<string>();
  return {
    used: () => [...used],
    async shared<T>(name: string, start: (sut: SharedSut) => Promise<T>): Promise<Shared<T>> {
      if (!NAME.test(name)) throw new Error(`sut.shared: "${name}" is not a name of lower-case letters, digits and -`);
      used.add(name);
      if (scenarioShared(moduleRoot, scenario) !== name) {
        throw new Error(`${scenario} uses sut.shared("${name}") but has no tag @shared=${name}`);
      }
      const run = sharedRun();
      const group = join(run.dir, name);
      const mark = (kind: Kind) => writeFileSync(join(group, kind), "");
      let started = groups.get(name);
      if (!started) {
        started = startOrWait(
          group,
          scenario,
          () => {
            const workspace = tempFolder("osf-sut-");
            // Written first, so the run takes the system down even when this process ends during the start.
            writeJson(join(group, "workspace.json"), { workspace });
            return { workspace, sut: open(workspace, true, run.owner, mark) };
          },
          start,
        );
        groups.set(name, started);
      }
      const { workspace, starter, result, error } = await started;
      if (error !== undefined) throw new Error(`the shared start "${name}" failed in ${starter}: ${error}`);
      return { sut: open(workspace, false, run.owner, mark), result: result as T };
    },
  };
}

/** The run's folder of shared starts, from the testkit's global setup. */
function sharedRun(): SharedRun {
  const run = inject("osfTestkitShared") as SharedRun | undefined;
  if (!run) {
    throw new Error(
      'sut.shared needs the testkit\'s global setup: add globalSetup: ["@opensoftware/testkit/global-setup"] to the vitest config',
    );
  }
  return run;
}

/** Runs the start when this process is the first to make the group's folder; otherwise waits for its record. */
async function startOrWait<T>(
  group: string,
  scenario: string,
  prepare: () => { workspace: string; sut: SharedSut },
  start: (sut: SharedSut) => Promise<T>,
): Promise<Started> {
  const record = join(group, "start.json");
  try {
    mkdirSync(group);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // Another scenario starts it; the test's timeout ends the wait when that process never writes the record.
    while (!existsSync(record)) await new Promise((resolve) => setTimeout(resolve, 250));
    return JSON.parse(readFileSync(record, "utf8")) as Started;
  }
  const { workspace, sut } = prepare();
  let started: Started;
  try {
    started = { workspace, starter: scenario, result: await start(sut) };
  } catch (error) {
    started = { workspace, starter: scenario, error: error instanceof Error ? error.message : String(error) };
  }
  writeJson(record, started);
  return started;
}

/** Writes the file whole or not at all, so a process that waits for it never reads half of it. */
function writeJson(path: string, value: unknown): void {
  writeFileSync(`${path}.tmp`, JSON.stringify(value));
  renameSync(`${path}.tmp`, path);
}

/** Takes down every system the run's shared starts brought up, and removes their workspaces and the run's folder. */
export async function sharedDown(dir: string): Promise<void> {
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const group = join(dir, name);
    const at = join(group, "workspace.json");
    if (!existsSync(at)) continue;
    const { workspace } = JSON.parse(readFileSync(at, "utf8")) as { workspace: string };
    const dirs = foldersOf(workspace);
    if (existsSync(join(group, "compose"))) await composeDown(dirs);
    if (existsSync(join(group, "helm"))) await helmDown(dirs);
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  rmSync(dir, { recursive: true, force: true });
}
