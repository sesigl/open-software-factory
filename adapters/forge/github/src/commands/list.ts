// prs: the pull requests whose branch starts with a prefix, with their review state (ADR 0073).
import { check, type Outcome } from "@opensoftware/cli";
import type { GitHub } from "../adapters/github.ts";
import { LIST_STATES, reviewState } from "../domain/repository.ts";
import { connect, count } from "./shared.ts";

/** The most pull requests GitHub gives on one page. */
const PAGE = 100;
/** The most pages prs reads: 2,000 pull requests. */
const PAGES = 20;

/** The fields of GitHub's list of pull requests that prs prints. */
interface ListedPull {
  number: number;
  html_url: string;
  title: string;
  state: "open" | "closed";
  merged_at: string | null;
  merge_commit_sha: string | null;
  created_at: string;
  head: { ref: string };
  base: { ref: string };
  user: { login: string };
  draft?: boolean;
}

/**
 * The pull requests in the state whose branch starts with the prefix, newest first, page by page: GitHub lists the
 * newest first, so the pages stop once they hold `most`.
 */
async function newestPulls(api: GitHub, state: string, head: string, most: number): Promise<ListedPull[]> {
  const pulls: ListedPull[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const query = `state=${state}&sort=created&direction=desc&per_page=${PAGE}&page=${page}`;
    const batch = await api.request<ListedPull[]>("GET", `/pulls?${query}`);
    pulls.push(...batch.filter((pull) => pull.head.ref.startsWith(head)));
    if (batch.length < PAGE || pulls.length >= most) break;
  }
  return pulls;
}

/**
 * prs <repo> [--head <prefix>] [--state open|closed|all] [--limit <n>]: one line per pull request, the highest number
 * first, at most `limit`.
 */
export async function prs(repo: string | undefined, head = "", state = "open", limit?: string): Promise<Outcome> {
  const api = connect(repo);
  check((LIST_STATES as readonly string[]).includes(state), `--state is one of ${LIST_STATES.join(", ")}`);
  const most =
    limit === undefined ? Number.POSITIVE_INFINITY : count(limit, 1, "--limit takes a number, like --limit 20");
  const pulls = (await newestPulls(api, state, head, most)).sort((a, b) => b.number - a.number).slice(0, most);
  const lines: string[] = [];
  for (const pull of pulls) {
    const reviews = await api.request<{ user: { login: string }; state: string }[]>(
      "GET",
      `/pulls/${pull.number}/reviews?per_page=${PAGE}`,
    );
    lines.push(
      JSON.stringify({
        number: pull.number,
        url: pull.html_url,
        title: pull.title,
        state: pull.merged_at ? "merged" : pull.state,
        head: pull.head.ref,
        base: pull.base.ref,
        author: `github:${pull.user.login}`,
        created: pull.created_at,
        draft: pull.draft === true,
        review: reviewState(reviews),
        ...(pull.merged_at ? { mergeCommit: pull.merge_commit_sha } : {}),
      }),
    );
  }
  return { lines };
}
