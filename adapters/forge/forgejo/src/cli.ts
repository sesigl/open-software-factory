#!/usr/bin/env node
// forge-forgejo <command>: the entry layer only parses arguments and calls the commands (ADR 0057).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { branch } from "./commands/branch.ts";
import { check } from "./commands/check.ts";
import { comment, comments } from "./commands/comment.ts";
import { event } from "./commands/event.ts";
import { merge } from "./commands/merge.ts";
import { openPr } from "./commands/open-pr.ts";
import { pr } from "./commands/pr.ts";
import { protect } from "./commands/protect.ts";
import { hooks, unhook, webhook } from "./commands/webhook.ts";

const USAGE = `Usage: forge-forgejo <command>

Commands:
  branch <repo> <branch> [--from <ref>]                  Create a branch; print {"branch", "sha"}.
  open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]
                                                         Open a pull request; print {"number", "url", "head", "base", "sha"}.
  pr <repo> <number>                                     Print the pull request's merge state and checks.
  check <repo> <sha> <name> <pending|success|failure|error> [--description <text>] [--url <url>]
                                                         Post a check on a commit.
  comment <repo> <number> <text>                         Comment on a pull request; print {"id", "url"}.
  comments <repo> <number>                               Print each comment of the pull request, oldest first.
  protect <repo> <branch> [--check <name>]... [--approvals <n>]
                                                         Set the branch's merge rules.
  merge <repo> <number> [--method merge|squash|rebase]   Merge; print {"sha"} of the merge commit.
  webhook <repo> <url> [--event <name>]...               Register one webhook for the events, by default pull requests;
                                                         print {"id", "url", "events", "active"}.
  hooks <repo>                                           Print each webhook of the repository.
  unhook <repo> <id>                                     Remove a webhook; print {"id", "removed"}.
  event <delivery.json>                                  Print the delivery's pull request or issue CloudEvent.

A repository is <owner>/<name>.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    from: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    base: { type: "string" },
    description: { type: "string" },
    url: { type: "string" },
    check: { type: "string", multiple: true },
    approvals: { type: "string" },
    method: { type: "string" },
    event: { type: "string", multiple: true },
  },
});
const [name, first, second, third, fourth, fifth] = positionals;

const commands: Record<string, Command> = {
  branch: () => branch(first, second, values.from),
  "open-pr": () => openPr(first, second, values),
  pr: () => pr(first, second),
  check: () => check(first, second, third, fourth, values),
  comment: () => comment(first, second, third),
  comments: () => comments(first, second),
  protect: () => protect(first, second, values.check ?? [], values.approvals),
  merge: () => merge(first, second, values.method),
  webhook: () => webhook(first, second, values.event ?? []),
  hooks: () => hooks(first),
  unhook: () => unhook(first, second),
  event: () => event(first),
};

process.exitCode = await runProgram({
  name: "forge-forgejo",
  usage: USAGE,
  command: name === undefined || fifth !== undefined ? undefined : commands[name],
  help: values.help,
});
