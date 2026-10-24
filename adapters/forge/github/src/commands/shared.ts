// What every command needs: GitHub for the repository named on the command line, numbers from the command line, and
// one JSON line as output.
import { check, type Outcome } from "@opensoftware/cli";
import { type GitHub, github } from "../adapters/github.ts";
import { REPOSITORY } from "../domain/repository.ts";

/** GitHub for "<owner>/<name>". */
export function connect(repo: string | undefined): GitHub {
  check(repo !== undefined && REPOSITORY.test(repo), "name the repository as <owner>/<name>, like tester/web");
  return github(repo as string);
}

/** A whole number from the command line, at least `min`. */
export function count(text: string | undefined, min: number, hint: string): number {
  const value = Number(text);
  check(text !== undefined && Number.isInteger(value) && value >= min, hint);
  return value;
}

/** A pull request's number. */
export const numberOf = (text: string | undefined) => count(text, 1, "name the pull request by its number, like 7");

export function print(value: Record<string, unknown>): Outcome {
  return { lines: [JSON.stringify(value)] };
}
