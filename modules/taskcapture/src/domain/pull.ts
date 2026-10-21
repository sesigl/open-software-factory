// Which pull request a URL names, where its forge API is, and what taskcapture needs from the forge's answer.
// GitHub writes /<owner>/<repo>/pull/<n>, Forgejo /<owner>/<repo>/pulls/<n>; both APIs answer the same fields.
import { usage } from "./errors.ts";

export interface PullRef {
  url: string;
  owner: string;
  repo: string;
  number: number;
  /** Base URL of the forge API, without a trailing slash. */
  api: string;
  /** The repository to clone: the pull request URL's origin, owner and repository. */
  cloneUrl: string;
}

/** Hosts whose API does not live below the host itself; GitHub Enterprise answers at /api/v3, Forgejo at /api/v1. */
const API_OF_HOST: Record<string, string> = { "github.com": "https://api.github.com" };

/** The pull request a URL names. `forge` is "github" or "forgejo" for a host whose kind the path does not tell. */
export function pullRefOf(url: string, forge: string | undefined, apiOverride: string | undefined): PullRef {
  const parsed = URL.canParse(url) ? new URL(url) : undefined;
  const [owner, repo, kind, number] = parsed?.pathname.split("/").filter(Boolean) ?? [];
  usage(
    parsed && owner && repo && (kind === "pull" || kind === "pulls") && /^\d+$/.test(number ?? ""),
    `${url} is not a pull request URL like https://github.com/acme/web/pull/7`,
  );
  usage(forge === undefined || forge === "github" || forge === "forgejo", "--forge takes github or forgejo");
  const github = (forge ?? (kind === "pull" ? "github" : "forgejo")) === "github";
  const api = (apiOverride || (API_OF_HOST[parsed.host] ?? `${parsed.origin}/api/${github ? "v3" : "v1"}`)).replace(
    /\/+$/,
    "",
  );
  return { url, owner, repo, number: Number(number), api, cloneUrl: `${parsed.origin}/${owner}/${repo}.git` };
}

/** The API path of the pull request. */
export const pullPath = (ref: PullRef): string => `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;

export interface MergedPull {
  title: string;
  body: string;
  mergeCommit: string;
}

interface PullJson {
  title?: string;
  body?: string | null;
  merged?: boolean;
  merge_commit_sha?: string | null;
}

/** The fields of a merged pull request; a pull request that is not merged cannot be a task. */
export function mergedPull(ref: PullRef, json: PullJson): MergedPull {
  if (!json.merged || !json.merge_commit_sha) throw new Error(`the pull request ${ref.url} is not merged`);
  return {
    title: json.title ?? "",
    body: json.body ?? "",
    mergeCommit: json.merge_commit_sha,
  };
}
