// comment <repo> <number> <text> and comments <repo> <number>: a pull request's conversation.
import { check, type Outcome } from "@opensoftware/cli";
import { about, forge, line, pullNumber } from "./forge.ts";

interface CommentJson {
  id: number;
  html_url: string;
  body: string;
  created_at: string;
  user: { login: string };
}

export async function comment(
  repo: string | undefined,
  number: string | undefined,
  text: string | undefined,
): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  check(text, "give the comment's text, like comment tester/web 7 'Evidence attached'");
  const posted = await about(repo as string, issue, () =>
    api.call<{ id: number; html_url: string }>("POST", `/issues/${issue}/comments`, { body: text }),
  );
  return line({ id: posted.id, url: posted.html_url });
}

/** One line per comment, oldest first; `mine` marks the comments of the token's user (ADR 0061). */
export async function comments(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  // Forgejo answers a missing pull request's comments with an empty list, so comments asks for the pull request.
  await about(repo as string, issue, () => api.call("GET", `/pulls/${issue}`));
  const list = await api.call<CommentJson[]>("GET", `/issues/${issue}/comments`);
  const me = await api.user();
  return {
    lines: list.map((entry) =>
      JSON.stringify({
        id: entry.id,
        url: entry.html_url,
        author: `forgejo:${entry.user.login}`,
        time: entry.created_at,
        text: entry.body,
        mine: entry.user.login === me,
      }),
    ),
  };
}
