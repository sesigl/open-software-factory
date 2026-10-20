// Asks Git in the current folder for the commit that was verified.
import { execFileSync } from "node:child_process";

export function headCommit(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}
