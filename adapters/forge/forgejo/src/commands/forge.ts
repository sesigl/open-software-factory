// What the commands share: the repository named on the command line and the forge's answers they read.
import { check, type Outcome } from "@opensoftware/cli";
import { ForgeError, type Repository, repository } from "../adapters/forgejo.ts";
import { repositoryName } from "../domain/repository.ts";

/** The forge's API for the repository named "<owner>/<name>". */
export function forge(repo: string | undefined): Repository {
  const name = repositoryName(repo);
  check(name !== undefined, "name the repository as <owner>/<name>, like tester/web");
  return repository(name as string);
}

/** A pull request number named on the command line. */
export function pullNumber(text: string | undefined): number {
  const number = Number(text);
  check(Number.isInteger(number) && number > 0, "name the pull request by its number, like 7");
  return number;
}

/** One JSON line. */
export function line(value: unknown): Outcome {
  return { lines: [JSON.stringify(value)] };
}

/** The repository's default branch. */
export async function defaultBranch(api: Repository): Promise<string> {
  return (await api.call<{ default_branch: string }>("GET", "")).default_branch;
}

/** The fields of Forgejo's pull request JSON that the commands read. */
export interface Pull {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  mergeable: boolean;
  merge_commit_sha: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  labels?: { name: string }[] | null;
  draft?: boolean;
}

/** Runs a call about the pull request and names a pull request the repository does not have. */
export async function about<T>(repo: string, number: number, call: () => Promise<T>): Promise<T> {
  return call().catch((error: unknown) => {
    if (error instanceof ForgeError && error.status === 404) throw new Error(`no pull request ${repo}#${number}`);
    throw error;
  });
}

/** Forgejo checks whether a new pull request can merge in the background; the commands wait this long for it. */
const SETTLE_MS = 10_000;
const PAUSE_MS = 250;

/** Calls `read` until `settled` holds for its answer or 10 seconds passed, and gives the last answer. */
export async function settle<T>(read: () => Promise<T>, settled: (answer: T) => boolean): Promise<T> {
  const started = Date.now();
  let answer = await read();
  while (!settled(answer) && Date.now() - started < SETTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    answer = await read();
  }
  return answer;
}
