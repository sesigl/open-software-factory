#!/usr/bin/env node
// forge-github <command>: the entry layer only reads the command line and calls a command (ADR 0058).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { branch, openPr } from "./commands/branches.ts";
import { event, hooks, unhook, webhook } from "./commands/hooks.ts";
import { prs } from "./commands/list.ts";
import { check, comment, comments, merge, pr, protect } from "./commands/pulls.ts";

const USAGE = `Usage: forge-github <command>

Commands:
  branch <repo> <branch> [--from <ref>]                  Create a branch; print {"branch", "sha"}.
  open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]
                                                         Open a pull request; print {"number", "url", "head", "base", "sha"}.
  pr <repo> <number>                                     Print the pull request's merge state and checks.
  prs <repo> [--head <prefix>] [--state open|closed|all] Print each pull request whose branch starts with the prefix,
                                                         newest first, with its review state.
  check <repo> <sha> <name> <pending|success|failure|error> [--description <text>] [--url <url>]
                                                         Post a check (a commit status) on a commit.
  comment <repo> <number> <text>                         Comment on a pull request; print {"id", "url"}.
  comments <repo> <number>                               Print each comment of the pull request, oldest first.
  protect <repo> <branch> [--check <name>]... [--approvals <n>]
                                                         Replace the branch's protection.
  merge <repo> <number> [--method merge|squash|rebase]   Merge; print {"sha"} of the merge commit.
  webhook <repo> <url> [--event <name>]...               Register one webhook for the events, by default pull requests;
                                                         print {"id", "url", "events", "active"}.
  hooks <repo>                                           Print each webhook of the repository.
  unhook <repo> <id>                                     Remove a webhook; print {"id", "removed"}.
  event <delivery.json>                                  Print the delivery's pull request or issue CloudEvent.

A repository is <owner>/<name>. FORGE_URL is GitHub's API, by default https://api.github.com.
`;

const text = { type: "string" } as const;
const { positionals: words, values: flags } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    check: { type: "string", multiple: true },
    event: { type: "string", multiple: true },
    ...Object.fromEntries(
      ["from", "title", "body", "base", "description", "url", "approvals", "method", "head", "state"].map((name) => [
        name,
        text,
      ]),
    ),
  },
});
const option = (name: string) => flags[name as keyof typeof flags] as string | undefined;
const [name, ...rest] = words;
const [a, b, c, d] = rest;

const commands: Record<string, [arity: number, Command]> = {
  branch: [2, () => branch(a, b, option("from"))],
  "open-pr": [2, () => openPr(a, b, { title: option("title"), body: option("body"), base: option("base") })],
  pr: [2, () => pr(a, b)],
  prs: [1, () => prs(a, option("head"), option("state"))],
  check: [4, () => check(a, b, c, d, { description: option("description"), url: option("url") })],
  comment: [3, () => comment(a, b, c)],
  comments: [2, () => comments(a, b)],
  protect: [2, () => protect(a, b, (flags.check as string[] | undefined) ?? [], option("approvals"))],
  merge: [2, () => merge(a, b, option("method"))],
  webhook: [2, () => webhook(a, b, (flags.event as string[] | undefined) ?? [])],
  hooks: [1, () => hooks(a)],
  unhook: [2, () => unhook(a, b)],
  event: [1, () => event(a)],
};
const chosen = name === undefined ? undefined : commands[name];

process.exitCode = await runProgram({
  name: "forge-github",
  usage: USAGE,
  command: chosen && rest.length <= chosen[0] ? chosen[1] : undefined,
  help: flags.help as boolean | undefined,
});
