import { spawnSync } from "node:child_process";

function git(root: string, args: string[]): { ok: boolean; out: string } {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: result.status === 0, out: result.stdout ?? "" };
}

/** The base ref from OSF_BASE, resolved to a commit; undefined when unset. Throws when it is not a commit. */
export function baseCommit(root: string): string | undefined {
  const ref = process.env.OSF_BASE?.trim();
  if (!ref) return undefined;
  const resolved = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (!resolved.ok) throw new Error(`OSF_BASE=${ref} is not a commit in this repository`);
  return resolved.out.trim();
}

/** The highest version tag matching the pattern that HEAD contains, for example the last `contracts-v*` release. */
export function lastTag(root: string, pattern: string): string | undefined {
  const tags = git(root, ["tag", "--list", pattern, "--merged", "HEAD", "--sort=-v:refname"]);
  return tags.ok ? tags.out.split("\n")[0]?.trim() || undefined : undefined;
}

/** Files that differ between the base commit and the working tree, plus untracked files. */
export function changedFiles(root: string, base: string): string[] {
  const diff = git(root, ["diff", "--name-only", "-z", "--no-renames", base]).out.split("\0");
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).out.split("\0");
  return [...new Set([...diff, ...untracked].filter(Boolean))].sort();
}

export function filesAt(root: string, base: string): string[] {
  return git(root, ["ls-tree", "-r", "--name-only", "-z", base]).out.split("\0").filter(Boolean);
}

export function showAt(root: string, base: string, file: string): string | undefined {
  const shown = git(root, ["show", `${base}:${file}`]);
  return shown.ok ? shown.out : undefined;
}
