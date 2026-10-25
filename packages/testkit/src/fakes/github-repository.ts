// The repositories of the fake GitHub (ADR 0058): commits that hold their files, branches, and three-way merges. Commit
// SHAs come from a counter and the content, so a scenario sees the same SHAs each run.
import { createHash } from "node:crypto";

export type Files = Record<string, string>;

export interface Commit {
  sha: string;
  parents: string[];
  message: string;
  files: Files;
}

export class Commits {
  private readonly bySha = new Map<string, Commit>();
  private counter = 0;

  /** Stores a commit with these parents and files and gives its SHA. */
  add(parents: string[], message: string, files: Files): string {
    const content = JSON.stringify([++this.counter, parents, message, Object.entries(files).sort()]);
    const sha = createHash("sha1").update(content).digest("hex");
    this.bySha.set(sha, { sha, parents, message, files: { ...files } });
    return sha;
  }

  get(sha: string): Commit | undefined {
    return this.bySha.get(sha);
  }

  /** The commit with this full SHA or SHA prefix of 7 or more characters. */
  find(text: string): Commit | undefined {
    if (text.length < 7) return undefined;
    return this.bySha.get(text) ?? [...this.bySha.values()].find((commit) => commit.sha.startsWith(text));
  }

  /** The newest common ancestor of two commits, found breadth first from `b`. */
  mergeBase(a: string, b: string): Commit | undefined {
    const ancestors = new Set<string>();
    const walk = [a];
    for (let sha = walk.shift(); sha !== undefined; sha = walk.shift()) {
      if (ancestors.has(sha)) continue;
      ancestors.add(sha);
      walk.push(...(this.bySha.get(sha)?.parents ?? []));
    }
    const queue = [b];
    for (let sha = queue.shift(); sha !== undefined; sha = queue.shift()) {
      if (ancestors.has(sha)) return this.bySha.get(sha);
      queue.push(...(this.bySha.get(sha)?.parents ?? []));
    }
    return undefined;
  }

  /**
   * The files of merging `head` into `base`: each path takes the side that changed it since their merge base. A path
   * both sides changed in different ways is a conflict, and the merge gives undefined.
   */
  merged(base: string, head: string): Files | undefined {
    const ours = this.bySha.get(base)?.files ?? {};
    const theirs = this.bySha.get(head)?.files ?? {};
    const ancestor = this.mergeBase(base, head)?.files ?? {};
    const files: Files = {};
    for (const path of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      const [was, mine, other] = [ancestor[path], ours[path], theirs[path]];
      if (mine !== other && mine !== was && other !== was) return undefined;
      const content = mine === was ? other : mine;
      if (content !== undefined) files[path] = content;
    }
    return files;
  }

  /** The paths that `head` added, changed or removed since its merge base with `base`, sorted. */
  changed(base: string, head: string): string[] {
    const theirs = this.bySha.get(head)?.files ?? {};
    const ancestor = this.mergeBase(base, head)?.files ?? {};
    const paths = new Set([...Object.keys(ancestor), ...Object.keys(theirs)]);
    return [...paths].filter((path) => ancestor[path] !== theirs[path]).sort();
  }
}
