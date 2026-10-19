import picomatch from "picomatch";
import type { Repo } from "./repo.ts";

const LOCATIONS = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];

interface Rule {
  matches: (file: string) => boolean;
  owners: string[];
}

/** The owners of a path under CODEOWNERS rules: the last matching line wins. */
export function ownersOf(repo: Repo, file: string): string[] {
  let owners: string[] = [];
  for (const rule of loadRules(repo)) if (rule.matches(file)) owners = rule.owners;
  return owners;
}

function loadRules(repo: Repo): Rule[] {
  const location = LOCATIONS.find((path) => repo.exists(path));
  if (!location) return [];
  return repo
    .read(location)
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const [pattern = "", ...owners] = line.split(/\s+/);
      return { matches: toMatcher(pattern), owners };
    });
}

/** CODEOWNERS uses gitignore-style patterns. */
function toMatcher(pattern: string): (file: string) => boolean {
  const anchored = pattern.startsWith("/") || pattern.slice(0, -1).includes("/");
  let glob = pattern.replace(/^\//, "");
  if (!anchored && !glob.startsWith("**/")) glob = `**/${glob}`;
  const globs = glob.endsWith("/") ? [`${glob}**`] : [glob, `${glob}/**`];
  return picomatch(globs, { dot: true });
}

interface Review {
  user?: { login?: string } | string;
  login?: string;
  state?: string;
}

/** Logins whose latest review approves, from a GitHub reviews JSON file (OSF_APPROVALS). */
export function approvers(repo: Repo): Set<string> {
  const file = process.env.OSF_APPROVALS;
  if (!file || !repo.exists(file)) return new Set();
  const reviews = JSON.parse(repo.read(file)) as Review[];
  const latest = new Map<string, string>();
  for (const review of reviews) {
    const login = typeof review.user === "string" ? review.user : (review.user?.login ?? review.login);
    if (login && review.state && review.state !== "COMMENTED") latest.set(login.toLowerCase(), review.state);
  }
  return new Set([...latest].filter(([, state]) => state === "APPROVED").map(([login]) => login));
}
