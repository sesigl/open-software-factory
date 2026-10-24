// What the system tests of this adapter share: the testkit's fake GitHub with the pull request "tester/web#1", whose
// conversation is the test chat, a webhook for its comments, and the adapter's CLI with the API's URL, the bot's token
// and the webhook's secret. The bot is "tester", the token's user; the person is "reviewer". Each helper only calls
// the adapter's CLI through sut, or the testkit's fakes.
import type { FakeGitHub, PullRequest, ScenarioContext } from "@opensoftware/testkit";

type Sut = ScenarioContext["sut"];
type Fakes = ScenarioContext["fakes"];

export const SECRET = "whsec-7a1e";
export const PERSON = "reviewer";

export interface Setup {
  github: FakeGitHub;
  pr: PullRequest;
  /** The pull request's conversation as a thread. */
  thread: string;
  /** Runs the adapter with the API's URL, the token and the secret; `env` adds or replaces variables. */
  run(args: string[], env?: Record<string, string>): ReturnType<Sut["cli"]>;
  /** Runs the adapter, expects exit code 0, and gives the JSON of its one line. */
  json(args: string[]): Promise<Record<string, unknown>>;
  /** Writes the delivery of the comment to $INPUT/delivery.json as the receiver got it; gives the file's name. */
  delivery(comment: { id: number }): Promise<string>;
}

export async function setup(sut: Sut, fakes: Fakes): Promise<Setup> {
  const github = await fakes.github();
  await github.createRepository("web", { "app.js": "export const app = 1;\n" });
  const receiver = await fakes.http([{ method: "POST", path: "/github", body: {} }]);
  const hook = await fetch(`${github.url}/repos/tester/web/hooks`, {
    method: "POST",
    headers: { authorization: `Bearer ${github.token}` },
    body: JSON.stringify({
      events: ["issue_comment"],
      config: { url: `${receiver.url}/github`, content_type: "json", secret: SECRET },
    }),
  });
  expect(hook.status).toBe(201);
  const pr = await github.openPullRequest("web", {
    branch: "fix-checkout",
    title: "Fix checkout button on Safari",
    files: { "checkout.js": "export const fixed = true;\n" },
  });
  const base = { CHANNEL_API_URL: github.url, CHANNEL_TOKEN: github.token, CHANNEL_SIGNING_SECRET: SECRET };
  const run = (args: string[], env: Record<string, string> = {}) => sut.cli(args, { env: { ...base, ...env } });
  // Each comment, the bot's too, sends one issue_comment delivery, in no fixed order.
  const find = (id: number) =>
    receiver
      .texts()
      .findIndex((request) => (JSON.parse(request.text) as { comment?: { id: number } }).comment?.id === id);
  return {
    github,
    pr,
    thread: `github:tester/web:${pr.number}`,
    run,
    async json(args) {
      const result = await run(args);
      if (result.exitCode !== 0) throw new Error(`${args[0]} exited with ${result.exitCode}: ${result.stderr}`);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    },
    async delivery(comment) {
      await expect.poll(() => find(comment.id), { timeout: 10_000, interval: 50 }).toBeGreaterThanOrEqual(0);
      const index = find(comment.id);
      const headers = receiver.headers()[index]?.headers;
      const body = receiver.texts()[index]?.text;
      await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers, body }));
      return "delivery.json";
    },
  };
}

/** The person's comment on the pull request that mentions the bot, as a delivery file. */
export async function mention(box: Setup, text = "Fix the checkout button on Safari", as = PERSON) {
  const comment = await box.github.say(box.pr, `@tester ${text}`, as);
  return { comment, file: await box.delivery(comment) };
}

/** The thread of a work item that receive printed for the person's comment. */
export async function thread(box: Setup): Promise<string> {
  const { file } = await mention(box);
  const printed = (await box.json(["receive", file])) as { workItem: { origin: { externalId: string } } };
  return printed.workItem.origin.externalId;
}
