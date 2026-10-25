// The channel and forge ports' adapters as programs (ADR 0061): a Slack channel through the channel port, the
// comments and the commit status of a pull request through the forge port. The adapters talk to Slack and the forge.
import { type Adapter, runAdapter } from "@opensoftware/cli";
import type { Channel, Message } from "../domain/gate.ts";
import type { PullJson, PullRequest } from "../domain/pull-request.ts";
import { fromIso } from "../domain/time.ts";

/** A message as the channel port's history and the forge port's comments print it. */
interface Said {
  id: string | number;
  thread?: string;
  person: string;
  time: string;
  text: string;
  mine: boolean;
}

/** What reply, ask and comment print. */
interface Posted {
  id: string | number;
  thread?: string;
  time: string;
}

const messageOf = (said: Said): Message => ({
  id: String(said.id),
  thread: said.thread,
  author: said.person,
  time: fromIso(said.time),
  text: said.text,
  mine: said.mine,
});

const postedOf = (posted: Posted, text: string): Message => ({
  id: String(posted.id),
  thread: posted.thread,
  author: "",
  time: fromIso(posted.time),
  text,
  mine: true,
});

/** Runs the adapter and gives its JSON lines. */
const run = <T>(adapter: Adapter, args: string[]) => runAdapter(adapter, args) as Promise<T[]>;

/** A Slack channel like "slack:C0GATES" through the channel port: the request starts a thread, decisions are replies. */
export function slackChannel(
  channel: string,
  adapter: Adapter,
): Channel & { receive(file: string, follow: string[]): Promise<Record<string, unknown>[]> } {
  const render = (text: string, marker: string): string => `${text}\n[${marker}]`;
  return {
    name: channel,
    mention: (identity) => (identity.startsWith("slack:") ? `<@${identity.slice(6)}>` : identity),
    howToDecide: 'Reply "approve" or "reject <reason>" in this thread.',
    async find(marker) {
      const said = await run<Said>(adapter, ["history", channel]);
      const found = said.find((message) => message.mine && message.text.includes(`[${marker}]`));
      return found && messageOf(found);
    },
    // The thread's history starts with the request itself, which decides nothing.
    async thread(request) {
      return (await run<Said>(adapter, ["history", request.thread ?? channel])).map(messageOf);
    },
    async post(text, marker, request, choices) {
      const target = request?.thread ?? channel;
      const body = render(text, marker);
      const asked = choices?.length
        ? ["ask", target, body, ...choices.flatMap((choice) => ["--choice", choice])]
        : ["reply", target, body];
      const [posted] = await run<Posted>(adapter, asked);
      return postedOf(posted as Posted, body);
    },
    receive: (file, follow) =>
      run<Record<string, unknown>>(adapter, ["receive", file, ...follow.flatMap((thread) => ["--thread", thread])]),
  };
}

/** A pull request through the forge port: its facts, its comments as the channel and its commit status. */
export function pullRequestForge(pr: PullRequest, adapter: Adapter) {
  const number = String(pr.number);
  return {
    async read(): Promise<PullJson> {
      const [pull] = await run<PullJson>(adapter, ["pr", pr.repository, number]);
      return pull as PullJson;
    },
    async status(sha: string, state: "pending" | "success" | "failure", description: string): Promise<void> {
      await run(adapter, [
        "check",
        pr.repository,
        sha,
        "gatekeeper",
        state,
        "--description",
        description.slice(0, 140),
        "--url",
        pr.url,
      ]);
    },
    channel(): Channel {
      const comments = async () => (await run<Said>(adapter, ["comments", pr.repository, number])).map(messageOf);
      return {
        name: pr.url,
        mention: (identity) =>
          identity.startsWith(`${pr.forge}:`) ? `@${identity.slice(pr.forge.length + 1)}` : identity,
        howToDecide: 'Comment "/approve" or "/reject <reason>".',
        async find(marker) {
          return (await comments()).find((comment) => comment.mine && comment.text.includes(`<!-- ${marker} -->`));
        },
        async thread(request) {
          const all = await comments();
          return all.slice(all.findIndex((comment) => comment.id === request.id) + 1);
        },
        async post(text, marker) {
          const body = `${text}\n\n<!-- ${marker} -->`;
          const [posted] = await run<Posted>(adapter, ["comment", pr.repository, number, body]);
          return postedOf(posted as Posted, body);
        },
      };
    },
  };
}

export type PullRequestForge = ReturnType<typeof pullRequestForge>;
