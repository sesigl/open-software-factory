// Git: a shallow clone of the repository, the files of the change, one commit and a push of observer's branch.
// A token goes to Git as a header for one command, never into a file or a remote URL.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Clone {
  dir: string;
  /** The default branch: the branch the clone checked out. */
  base: string;
  read(path: string): string | undefined;
  /** Writes the files, commits them on `branch` and pushes only that branch. */
  push(branch: string, message: string, files: Map<string, string>): Promise<void>;
  close(): void;
}

export async function clone(url: string, token: string | undefined): Promise<Clone> {
  const auth = token
    ? ["-c", `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`]
    : [];
  const git = (dir: string, args: string[]): Promise<string> =>
    new Promise((resolve, reject) =>
      execFile("git", [...auth, ...args], { cwd: dir }, (error, stdout, stderr) =>
        error
          ? reject(
              new Error(`git ${args[0]} failed: ${(stderr.trim() || error.message).replaceAll(token ?? "\0", "***")}`),
            )
          : resolve(stdout.trim()),
      ),
    );
  const dir = mkdtempSync(join(tmpdir(), "observer-"));
  const close = () => rmSync(dir, { recursive: true, force: true });
  try {
    await git(dir, ["clone", "--quiet", "--depth", "1", url, "."]);
  } catch (error) {
    close();
    throw error;
  }
  const base = await git(dir, ["symbolic-ref", "--short", "HEAD"]);
  return {
    dir,
    base,
    read: (path) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path), "utf8") : undefined),
    async push(branch, message, files) {
      for (const [path, text] of files) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      await git(dir, ["checkout", "--quiet", "-b", branch]);
      await git(dir, ["add", "--", ...files.keys()]);
      await git(dir, [
        "-c",
        "user.name=observer",
        "-c",
        "user.email=observer@opensoftware.invalid",
        "commit",
        "--quiet",
        "-m",
        message,
      ]);
      await git(dir, ["push", "--quiet", "origin", `HEAD:refs/heads/${branch}`]);
    },
    close,
  };
}
