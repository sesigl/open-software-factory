// What the commands share: the repository named on the command line and the forge's answers they read.
import { check, type Outcome } from "@opensoftware/cli";
import { type Repository, repository } from "../adapters/forgejo.ts";
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
}
