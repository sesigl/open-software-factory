// The Git repository in the current folder: who works in it and which commit it is at.
import { spawnSync } from "node:child_process";

/** What git printed, or undefined when it failed. */
const git = (args: string[]): string | undefined => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
};

/** The commit of HEAD and the author's email (`git var GIT_AUTHOR_IDENT`); each undefined when Git has none. */
export function repository(): { commit?: string; email?: string } {
  return { commit: git(["rev-parse", "HEAD"]), email: git(["var", "GIT_AUTHOR_IDENT"])?.match(/<([^>]+)>/)?.[1] };
}
