// The two calls proof needs from a forge: one comment on a pull request and one commit status. GitHub's REST API
// and Forgejo's API v1 have the same shape for both (ADR 0028).
import type { PullRequest } from "../domain/verdict.ts";

export interface Forge {
  /** Edits the first comment that starts with the marker, or adds one. Returns "added" or "updated". */
  upsertComment(pr: PullRequest, marker: string, body: string): Promise<"added" | "updated">;
  setStatus(
    pr: PullRequest,
    commit: string,
    status: { state: string; description: string; target_url?: string },
  ): Promise<void>;
}

const PAGE = 100;

/** A forge API at `base` (for example https://api.github.com or https://forgejo.example/api/v1) with a token. */
export function forgeAt(base: string, token: string): Forge {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method,
      headers: { authorization: `token ${token}`, accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(`the forge answered ${response.status} to ${method} ${path.split("?")[0]}: ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };
  const repo = (pr: PullRequest): string => `/repos/${pr.owner}/${pr.repository}`;

  return {
    async upsertComment(pr, marker, body) {
      for (let page = 1; ; page++) {
        const comments = await call<{ id: number; body: string }[]>(
          "GET",
          `${repo(pr)}/issues/${pr.number}/comments?per_page=${PAGE}&page=${page}`,
        );
        const mine = comments.find((comment) => comment.body.startsWith(marker));
        if (mine) {
          await call("PATCH", `${repo(pr)}/issues/comments/${mine.id}`, { body });
          return "updated";
        }
        if (comments.length < PAGE) break;
      }
      await call("POST", `${repo(pr)}/issues/${pr.number}/comments`, { body });
      return "added";
    },
    async setStatus(pr, commit, status) {
      await call("POST", `${repo(pr)}/statuses/${commit}`, { context: "proof", ...status });
    },
  };
}
