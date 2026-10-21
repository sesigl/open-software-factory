// The three lists ledger reads from a forge: the pull requests of a repository, and the reviews and comments of
// each. GitHub's REST API and Forgejo's API v1 have the same paths and fields; only the paging differs (ADR 0036).
import type { ForgeComment, ForgePull, ForgeReview, Repository } from "../domain/forge.ts";

/** The most items a page holds: GitHub allows 100, Forgejo 50 by default. */
const PAGE = { github: 100, forgejo: 50 };

export interface ForgeClient {
  /** The pull requests, newest update first, until `keep` turns false for one. */
  pulls(keep: (pull: ForgePull) => boolean): Promise<ForgePull[]>;
  reviews(pull: ForgePull): Promise<ForgeReview[]>;
  comments(pull: ForgePull): Promise<ForgeComment[]>;
}

export function forgeClient(repository: Repository, token: string | undefined): ForgeClient {
  const size = PAGE[repository.kind];
  const paging = repository.kind === "github" ? `per_page=${size}` : `limit=${size}`;
  const repo = `/repos/${repository.owner}/${repository.name}`;

  const get = async <T>(path: string): Promise<T> => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) headers.authorization = `token ${token}`;
    const response = await fetch(`${repository.api}${path}`, { headers });
    const text = await response.text();
    if (!response.ok) throw new Error(`the forge answered ${response.status} to GET ${path.split("?")[0]}: ${text}`);
    return JSON.parse(text) as T;
  };
  /** Every page of a list, until a page is short or `keep` turns false. */
  const all = async <T>(path: string, keep: (item: T) => boolean = () => true): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const list = await get<T[]>(`${path}${path.includes("?") ? "&" : "?"}${paging}&page=${page}`);
      const kept = list.findIndex((item) => !keep(item));
      items.push(...(kept === -1 ? list : list.slice(0, kept)));
      if (kept !== -1 || list.length < size) return items;
    }
  };

  return {
    pulls: (keep) =>
      all<ForgePull>(
        `${repo}/pulls?state=all&${repository.kind === "github" ? "sort=updated&direction=desc" : "sort=recentupdate"}`,
        keep,
      ),
    reviews: (pull) => all<ForgeReview>(`${repo}/pulls/${pull.number}/reviews`),
    comments: (pull) => all<ForgeComment>(`${repo}/issues/${pull.number}/comments`),
  };
}
