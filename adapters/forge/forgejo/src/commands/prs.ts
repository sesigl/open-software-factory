// prs <repo> [--head <prefix>] [--state open|closed|all]: the pull requests whose branch starts with a prefix, the
// highest number first, each with its review state (ADR 0073).
import { check, type Outcome } from "@opensoftware/cli";
import type { Repository } from "../adapters/forgejo.ts";
import { LIST_STATES, type Review, reviewOf } from "../domain/reviews.ts";
import { forge, type Pull } from "./forge.ts";

/** The most items Forgejo answers on one page by default. */
const LIMIT = 50;

type Listed = Pull & { created_at: string };

/** The most pages prs reads of one list: 1,000 pull requests, or 1,000 reviews of one. */
const PAGES = 20;

/** Forgejo pages its answers; this reads pages until one is not full. */
async function pages<T>(api: Repository, path: string): Promise<T[]> {
  const all: T[] = [];
  const joiner = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= PAGES; page++) {
    const batch = await api.call<T[]>("GET", `${path}${joiner}limit=${LIMIT}&page=${page}`);
    all.push(...batch);
    if (batch.length < LIMIT) break;
  }
  return all;
}

export async function prs(repo: string | undefined, head = "", state = "open"): Promise<Outcome> {
  const api = forge(repo);
  check(LIST_STATES.includes(state), `--state is one of ${LIST_STATES.join(", ")}`);
  const listed = await pages<Listed>(api, `/pulls?state=${state}`);
  const chosen = listed.filter((pull) => pull.head.ref.startsWith(head)).sort((a, b) => b.number - a.number);
  const lines = await Promise.all(
    chosen.map(async (pull) => {
      const reviews = await pages<Review>(api, `/pulls/${pull.number}/reviews`);
      return JSON.stringify({
        number: pull.number,
        url: pull.html_url,
        title: pull.title,
        state: pull.merged ? "merged" : pull.state,
        head: pull.head.ref,
        base: pull.base.ref,
        author: `forgejo:${pull.user.login}`,
        created: pull.created_at,
        draft: pull.draft === true,
        review: reviewOf(reviews),
      });
    }),
  );
  return { lines };
}
