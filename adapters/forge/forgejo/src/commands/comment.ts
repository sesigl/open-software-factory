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
  const posted = await api.call<Comment>("POST", `/issues/${issue}/comments`, { body: text });
  return line({ id: posted.id, url: posted.html_url, time: rfc3339(posted.created_at) });
}

/** comments <repo> <number>: the comments of the pull request's conversation, oldest first. */
export async function comments(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  const me = await api.me();
  const list = await api.call<Comment[]>("GET", `/issues/${issue}/comments?limit=100`);
  return { lines: list.map((comment) => JSON.stringify(said(comment, me))) };
}

/** A comment of Forgejo's issue comments API. */
interface Comment {
  id: number;
  html_url: string;
  body: string;
  created_at: string;
  user: { login: string };
}

/** A comment as comments prints it, `mine` when the token's user `me` wrote it. */
function said({ id, user, created_at, body }: Comment, me: string) {
  return { id, person: `forgejo:${user.login}`, time: rfc3339(created_at), text: body, mine: user.login === me };
}

/** Forgejo's time, as RFC 3339 in UTC without fractions. */
const rfc3339 = (time: string): string => new Date(time).toISOString().replace(".000Z", "Z");
