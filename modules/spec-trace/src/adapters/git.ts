// The feature files of a base commit, read from the Git repository in the current folder.
import { spawnSync } from "node:child_process";
import picomatch from "picomatch";

/** Path and text of every file of the commit that matches the globs. Throws when the base is not a commit. */
export function filesAt(root: string, base: string, globs: string[]): { file: string; text: string }[] {
  const commit = git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  if (commit === undefined) throw new Error(`the base ${base} is not a commit of this repository`);
  const isMatch = picomatch(globs, { dot: true });
  return (git(root, ["ls-tree", "-r", "-z", "--name-only", commit.trim()]) ?? "")
    .split("\0")
    .filter((file) => file !== "" && isMatch(file))
    .sort()
    .map((file) => ({ file, text: git(root, ["show", `${commit.trim()}:${file}`]) ?? "" }));
}

function git(root: string, args: string[]): string | undefined {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : undefined;
}
