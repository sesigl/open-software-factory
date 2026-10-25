// comment <repo> <number> <text>: a comment on a pull request.
import { check, type Outcome } from "@opensoftware/cli";
import { forge, line, pullNumber } from "./forge.ts";

export async function comment(
  repo: string | undefined,
  number: string | undefined,
  text: string | undefined,
): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  check(text, "give the comment's text, like comment tester/web 7 'Evidence attached'");
  const posted = await api.call<CommentJson>("POST", `/issues/${issue}/comments`, { body: text });
  return line({ id: posted.id, url: posted.html_url, time: timeOf(posted) });
}

interface CommentJson {
  id: number;
  html_url: string;
  body: string;
  created_at: string;
  user: { login: string };
}

/** Forgejo's time of a comment, as RFC 3339 in UTC. */
const timeOf = (comment: CommentJson): string => new Date(comment.created_at).toISOString().replace(".000Z", "Z");

/** comments <repo> <number>: the comments of the pull request's conversation, oldest first. */
export async function comments(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  const [me, list] = await Promise.all([
    api.me(),
    api.call<CommentJson[]>("GET", `/issues/${issue}/comments?limit=100`),
  ]);
  return {
    lines: list.map((comment) =>
      JSON.stringify({
        id: comment.id,
        person: `forgejo:${comment.user.login}`,
        time: timeOf(comment),
        text: comment.body,
        mine: comment.user.login === me,
      }),
    ),
  };
}
