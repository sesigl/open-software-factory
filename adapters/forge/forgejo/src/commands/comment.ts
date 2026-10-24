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
  const posted = await api.call<{ id: number; html_url: string }>("POST", `/issues/${issue}/comments`, { body: text });
  return line({ id: posted.id, url: posted.html_url });
}
