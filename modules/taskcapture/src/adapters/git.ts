// The Git commands capture needs: a clone, the parent of the merge commit, the files the merge changed, a file's
// bytes at a commit and the tree of a commit. A token goes to Git as a header for this one call, never into a file.
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Change } from "../domain/task.ts";

const git = (cwd: string, args: string[], extra: string[] = []): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    execFile("git", [...extra, ...args], { cwd, encoding: "buffer", maxBuffer: 1 << 30 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`git ${args[0]} failed: ${stderr.toString().trim() || error.message}`));
      else resolve(stdout);
    });
  });

export interface Repository {
  dir: string;
  /** Removes the clone that capture made; a folder the user named stays. */
  close(): void;
}

/** The user's clone in `dir`, or a fresh clone of `cloneUrl`. */
export async function openRepository(
  dir: string | undefined,
  cloneUrl: string,
  token: string | undefined,
): Promise<Repository> {
  if (dir) return { dir, close() {} };
  const target = mkdtempSync(join(tmpdir(), "taskcapture-"));
  const auth = token ? ["-c", `http.extraHeader=Authorization: token ${token}`] : [];
  try {
    await git(target, ["clone", "--quiet", "--no-checkout", cloneUrl, "."], auth);
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw new Error(`could not clone ${cloneUrl}: ${(error as Error).message.replaceAll(token ?? "\0", "***")}`);
  }
  return { dir: target, close: () => rmSync(target, { recursive: true, force: true }) };
}

export async function parentOf(dir: string, commit: string): Promise<string> {
  try {
    return (await git(dir, ["rev-parse", "--verify", `${commit}^1^{commit}`])).toString().trim();
  } catch {
    throw new Error(`the commit ${commit} or its parent is not in the repository at ${dir}`);
  }
}

/** The files that differ between two commits, without rename detection. */
export async function changesBetween(dir: string, from: string, to: string): Promise<Change[]> {
  const fields = (await git(dir, ["diff", "--name-status", "--no-renames", "-z", from, to])).toString().split("\0");
  const changes: Change[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2)
    changes.push({ path: fields[index + 1] as string, deleted: fields[index] === "D" });
  return changes;
}

export const fileAt = (dir: string, commit: string, path: string): Promise<Buffer> =>
  git(dir, ["cat-file", "blob", `${commit}:${path}`]);

export async function hasFile(dir: string, commit: string, path: string): Promise<boolean> {
  try {
    await git(dir, ["cat-file", "-e", `${commit}:${path}`]);
    return true;
  } catch {
    return false;
  }
}

/** Writes the tree of `commit` into the folder `target`. */
export async function extractTree(dir: string, commit: string, target: string): Promise<void> {
  const archive = join(target, "..", ".repo.tar");
  await git(dir, ["archive", "--format=tar", "-o", archive, commit]);
  await new Promise<void>((resolve, reject) =>
    execFile("tar", ["-xf", archive, "-C", target], (error, _out, stderr) =>
      error ? reject(new Error(`tar failed: ${stderr}`)) : resolve(),
    ),
  );
  rmSync(archive);
}
