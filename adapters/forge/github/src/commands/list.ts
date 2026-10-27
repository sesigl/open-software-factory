// prs: the pull requests whose branch starts with a prefix, with their review state (ADR 0073).
import { check, type Outcome } from "@opensoftware/cli";
import type { GitHub } from "../adapters/github.ts";
import { LIST_STATES, reviewState } from "../domain/repository.ts";
import { connect } from "./shared.ts";

/** The most pull requests GitHub gives on one page. */
const PAGE = 100;

/** The fields of GitHub's list of pull requests that prs prints. */
interface ListedPull {
  number: number;
  html_url: string;
  title: string;
  state: "open" | "closed";
  merged_at: string | null;
  created_at: string;
  head: { ref: string };
  base: { ref: string };
  user: { login: string };
  draft?: boolean;
}

/** Every pull request in the state, newest first, page by page. */
async function everyPull(api: GitHub, state: string): Promise<ListedPull[]> {
  const pulls: ListedPull[] = [];
  let page = 0;
  let batch: ListedPull[];
  do {
    batch = await api.request<ListedPull[]>("GET", `/pulls?state=${state}&per_page=${PAGE}&page=${++page}`);
    pulls.push(...batch);
  } while (batch.length === PAGE);
  return pulls;
}

/** prs <repo> [--head <prefix>] [--state open|closed|all]: one line per pull request, the highest number first. */
export async function prs(repo: string | undefined, head = "", state = "open"): Promise<Outcome> {
  const api = connect(repo);
  check((LIST_STATES as readonly string[]).includes(state), `--state is one of ${LIST_STATES.join(", ")}`);
  const pulls = (await everyPull(api, state))
    .filter((pull) => pull.head.ref.startsWith(head))
    .sort((a, b) => b.number - a.number);
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
      }),
    );
  }
  return { lines };
}
