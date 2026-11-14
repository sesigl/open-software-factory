// The agent's repositories in the session's folder (ADR 0126): each one cloned with its default branch's last commit
// below `repositories/<name>`, before the folder is copied into a sandbox. A folder an earlier stage cloned stays.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DeclaredRepository } from "../domain/tools.ts";

export async function cloneRepositories(folder: string, repositories: DeclaredRepository[]): Promise<void> {
  for (const { name, url } of repositories) {
    const target = join(folder, "repositories", name);
    if (existsSync(target)) continue;
    await promisify(execFile)("git", ["clone", "--quiet", "--depth", "1", "--", url, target]);
  }
}
