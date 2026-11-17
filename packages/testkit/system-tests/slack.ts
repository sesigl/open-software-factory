// The client of the fakes.slack scenarios that call the fake in the test's process (ADR 0039): a module would call
// the Slack Web API the same way, with the URL and the token the fake gives, and check Slack's signature on what the
// fake delivers to it.
import type { FakeHttp, FakeSlack } from "@opensoftware/testkit";
import { hmacHex } from "./hmac.ts";

/** Calls a method of the Slack Web API with the bot token and gives the parsed answer. */
// biome-ignore lint/suspicious/noExplicitAny: the scenarios read Slack's JSON as a module would.
export async function slackCall(slack: FakeSlack, method: string, body: unknown): Promise<any> {
  const response = await fetch(`${slack.url}${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${slack.token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

/**
 * The text of each request the receiver got at `path`, with whether its Slack signature matches `secret`, as a
 * module's server checks it: `v0=` and the HMAC-SHA256 of `v0:<timestamp>:<body>`.
 */
export async function signedBodies(
  receiver: FakeHttp,
  path: string,
  secret: string,
): Promise<{ text: string; signed: boolean }[]> {
  const headers = receiver.headers().filter((entry) => entry.path === path);
  const texts = receiver.texts().filter((entry) => entry.path === path);
  return Promise.all(
    texts.map(async ({ text }, at) => {
      const sent = headers[at]?.headers ?? {};
      const mac = await hmacHex(secret, `v0:${sent["x-slack-request-timestamp"]}:${text}`);
      return { text, signed: sent["x-slack-signature"] === `v0=${mac}` };
    }),
  );
}
