// A version of a file from Git, for "factory diff HEAD~1:factory.yaml".
import { execFileSync } from "node:child_process";

export function showRevision(revision: string): string {
  return execFileSync("git", ["show", revision], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
