// open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]: a pull request into the default branch or
// the base.
import { check, type Outcome } from "@opensoftware/cli";
import { defaultBranch, forge, line, type Pull } from "./forge.ts";

export interface OpenOptions {
  title?: string;
  body?: string;
  base?: string;
}

export async function openPr(
  repo: string | undefined,
  head: string | undefined,
  options: OpenOptions,
): Promise<Outcome> {
  const api = forge(repo);
  check(head, "name the branch to merge, like open-pr tester/web fix-checkout --title ...");
  check(options.title, "give the pull request a --title");
  const pull = await api.call<Pull>("POST", "/pulls", {
    head,
    base: options.base ?? (await defaultBranch(api)),
    title: options.title,
    body: options.body ?? "",
  });
  return line({
    number: pull.number,
    url: pull.html_url,
    head: pull.head.ref,
    base: pull.base.ref,
    sha: pull.head.sha,
  });
}
