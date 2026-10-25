// The channel "demo" of the scenarios, whose webhook and post the test chooses, and a run of runChannel that keeps
// what it writes.
import type { Channel, Post, Posted, runChannel, Said, Webhook } from "@opensoftware/channel-kit";

type Io = NonNullable<Parameters<typeof runChannel>[2]>;

export interface Ran {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface Demo {
  channel: Channel;
  /** Every post, with its thread, in order. */
  posts: { thread: string; post: Post }[];
  /** The threads that receive was asked to follow. */
  followed: string[][];
}

/**
 * The channel "demo" with threads like "demo:7". `handle` gets the request and `keep`; its webhook answers 200
 * unless `status` says otherwise. `post` gives the ID `id`, or the whole `posted`; `history` gives `said`. With
 * `channels`, a channel is "demo".
 */
export function demo(
  options: {
    handle?: (request: Request, keep: Parameters<Channel["receive"]>[0]) => Promise<void>;
    status?: number;
    id?: string;
    posted?: Posted;
    said?: Said[];
    channels?: boolean;
  } = {},
): Demo {
  const posts: Demo["posts"] = [];
  const followed: string[][] = [];
  const channel: Channel = {
    name: "demo",
    thread: { form: "demo:<number>", pattern: /^demo:\d+$/ },
    ...(options.channels && { channel: { form: "demo", pattern: /^demo$/ } }),
    api: "The demo has no API.",
    async receive(keep, follow) {
      followed.push(follow);
      const webhook: Webhook = async (request, { waitUntil }) => {
        if (options.handle) waitUntil(options.handle(request, keep));
        return new Response("ok", { status: options.status ?? 200 });
      };
      return webhook;
    },
    async post(thread, post) {
      posts.push({ thread, post });
      return options.posted ?? { id: options.id ?? "m-0" };
    },
    async history() {
      return options.said ?? [];
    },
  };
  return { channel, posts, followed };
}

/** Runs `run` with an io that keeps standard output and error. */
export async function capture(run: (io: Io) => Promise<number>): Promise<Ran> {
  const ran: Ran = { exitCode: -1, stdout: "", stderr: "" };
  ran.exitCode = await run({
    stdout: { write: (text: string) => (ran.stdout += text) },
    stderr: { write: (text: string) => (ran.stderr += text) },
  });
  return ran;
}
