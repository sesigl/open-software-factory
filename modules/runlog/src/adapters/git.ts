// The Git repository in the current folder: who works in it and which commit it is at.
import { execFileSync } from "node:child_process";

const git = (args: string[]): string | undefined => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
};

/** The commit of HEAD and the author's email (`git var GIT_AUTHOR_IDENT`); each undefined when Git has none. */
export function repository(): { commit?: string; email?: string } {
  return { commit: git(["rev-parse", "HEAD"]), email: git(["var", "GIT_AUTHOR_IDENT"])?.match(/<([^>]+)>/)?.[1] };
}
