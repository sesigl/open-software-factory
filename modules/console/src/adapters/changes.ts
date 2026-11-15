// The programs and the fetch of a change (ADR 0144): the forge port's adapter with the token of the changes, for the
// commands `rules`, `branch`, `commit`, `open-pr`, `merge`, `prs`, `pr` and `close`; factory-spec's `factory edit`;
// and the newest commit of the factory's repository through @opensoftware/factory-source (ADR 0142). A failure is a
// note, never an exception.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FactorySource } from "@opensoftware/factory-source";
import type { Edit, Listed, Pull } from "../domain/changes.ts";
import { type Outcome, runProgram } from "./program.ts";

export type { Outcome };

export interface ChangeForge {
  /** The command line of the forge port's adapter, CONSOLE_FORGE_ADAPTER. */
  command: string;
  url: string | undefined;
  /** CONSOLE_FACTORY_TOKEN: it writes the contents and the pull requests of the repository. */
  token: string | undefined;
  /** The repository as "<owner>/<name>". */
  repository: string;
}

/** The JSON lines a command printed. */
const lines = <T>(stdout: string): T[] =>
  stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);

/** The first JSON line a command printed. */
const first = <T>(stdout: string): T => lines<T>(stdout)[0] as T;

/** Runs a command of the adapter on the repository with these arguments. */
const run = <T>(forge: ChangeForge, command: string, args: string[], read: (stdout: string) => T) =>
  runProgram(forge.command, [command, forge.repository, ...args], read, undefined, {
    FORGE_URL: forge.url,
    FORGE_TOKEN: forge.token,
  });

/** The names of the checks that the branch requires. */
export const requiredChecks = (forge: ChangeForge, branch: string) =>
  run(forge, "rules", [branch], (stdout) => first<{ checks: string[] }>(stdout).checks);

/**
 * The newest 50 pull requests of the repository, open and closed. Not with "--head": a forge that deleted the branch
 * of a closed pull request names another head for it, like Forgejo's "refs/pull/<n>/head".
 */
export const listChanges = (forge: ChangeForge) =>
  run(forge, "prs", ["--state", "all", "--limit", "50"], lines<Listed>);

/** One pull request with its merge state and checks. */
export const readChange = (forge: ChangeForge, number: number) => run(forge, "pr", [String(number)], first<Pull>);

/** Closes the pull request and deletes its branch. */
export const closeChange = (forge: ChangeForge, number: number) =>
  run(forge, "close", [String(number), "--delete-branch"], () => undefined);

/** Merges the pull request now, or with `whenGreen` asks the forge to merge it once its checks pass. */
export const mergeChange = (forge: ChangeForge, number: number, whenGreen: boolean) =>
  run(forge, "merge", [String(number), ...(whenGreen ? ["--when-green"] : [])], () => undefined);

/**
 * Opens the change: the branch from the commit, one commit of factory.yaml with the edited text, and the pull request
 * into the main branch. Gives the pull request's number.
 */
export async function openChange(
  forge: ChangeForge,
  change: { branch: string; from: string; base: string; text: string; message: string; title: string; body: string },
): Promise<Outcome<number>> {
  const branched = await run(forge, "branch", [change.branch, "--from", change.from], () => undefined);
  if (!branched.ok) return branched;
  const folder = await mkdtemp(join(tmpdir(), "console-change-"));
  try {
    const file = join(folder, "factory.yaml");
    await writeFile(file, change.text);
    const committed = await run(
      forge,
      "commit",
      [change.branch, "--message", change.message, `factory.yaml=${file}`],
      () => undefined,
    );
    if (!committed.ok) return committed;
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  const args = [change.branch, "--title", change.title, "--body", change.body, "--base", change.base];
  return run(forge, "open-pr", args, (stdout) => first<{ number: number }>(stdout).number);
}

/**
 * factory.yaml with the edit, as `factory edit` of the factory program prints it for the file, and whether it differs
 * from the file. The agent and the value come after "--", so no word of a form is an option.
 */
export async function editFactory(command: string, file: string, { edit, target, value }: Edit) {
  const original = await readFile(file, "utf8");
  return runProgram(command, ["edit", "--file", file, edit, "--", target, value], (text) => ({
    text,
    changed: text !== original,
  }));
}

/** The repository of the factory: its newest commit on the ref, fetched into the cache folder. */
export function factoryRepository(setting: string, cache: string, token: string | undefined) {
  // The library loads with the first change: most pages never fetch the repository.
  let loaded: Promise<{ source: FactorySource; FetchError: new (...args: never[]) => Error }> | undefined;
  return async (): Promise<Outcome<{ file: string; commit: string }>> => {
    loaded ??= import("@opensoftware/factory-source").then((library) => ({
      source: library.factorySource(setting, { cache, token }),
      FetchError: library.FetchError,
    }));
    const { source, FetchError } = await loaded;
    try {
      const { file, commit } = await source.fetch();
      return { ok: true, body: { file, commit: commit as string } };
    } catch (failure) {
      if (failure instanceof FetchError) return { ok: false, usage: false, note: failure.message };
      throw failure;
    }
  };
}
