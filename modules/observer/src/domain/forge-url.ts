// Where a repository or a pull request lives: its owner, name and number, its clone URL and its forge API.
// GitHub and Forgejo answer the calls observer makes alike; only the API's base URL differs.
import { UsageError } from "@opensoftware/cli";

export interface RepositoryRef {
  owner: string;
  repo: string;
  /** Base URL of the forge API, without a trailing slash. */
  api: string;
  cloneUrl: string;
}

export interface PullRequestRef {
  url: string;
  owner: string;
  repo: string;
  number: number;
  api: string;
}

/** The API base: GitHub's own host for github.com, `<origin>/api/v1` for Forgejo, or the override. */
const apiOf = (url: URL, override: string | undefined): string =>
  (override || (url.host === "github.com" ? "https://api.github.com" : `${url.origin}/api/v1`)).replace(/\/+$/, "");

function parts(url: string, example: string): { url: URL; path: string[] } {
  if (!URL.canParse(url)) throw new UsageError(`${url} is not a URL like ${example}`);
  const parsed = new URL(url);
  return {
    url: parsed,
    path: parsed.pathname
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean),
  };
}

/** A repository URL like https://github.com/acme/factory. */
export function repositoryOf(url: string, apiOverride: string | undefined): RepositoryRef {
  const { url: parsed, path } = parts(url, "https://github.com/acme/factory");
  const [owner, repo] = path;
  if (path.length !== 2 || !owner || !repo)
    throw new UsageError(`${url} is not a repository URL like https://github.com/acme/factory`);
  return { owner, repo, api: apiOf(parsed, apiOverride), cloneUrl: `${parsed.origin}/${owner}/${repo}.git` };
}

/** A pull request URL: GitHub writes /<owner>/<repo>/pull/<n>, Forgejo /<owner>/<repo>/pulls/<n>. */
export function pullRequestOf(url: string, apiOverride: string | undefined): PullRequestRef {
  const { url: parsed, path } = parts(url, "https://github.com/acme/factory/pull/12");
  const [owner = "", repo = "", kind, number = ""] = path;
  if (path.length !== 4 || !/^pulls?$/.test(kind ?? "") || !/^\d+$/.test(number))
    throw new UsageError(`${url} is not a pull request URL like https://github.com/acme/factory/pull/12`);
  return { url, owner, repo, number: Number(number), api: apiOf(parsed, apiOverride) };
}
