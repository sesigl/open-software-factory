// What the system tests of this adapter share: the testkit's fake Slack with the channel "C0WEB", a receiver that
// keeps Slack's deliveries, and the adapter's CLI with the Web API's URL, the bot token and the signing secret. Each
// helper only calls the adapter's CLI through sut, or the testkit's fakes.
import type { FakeSlack, ScenarioContext } from "@opensoftware/testkit";

type Sut = ScenarioContext["sut"];
type Fakes = ScenarioContext["fakes"];

export const CHANNEL = "C0WEB";
/** The person fakes.slack posts as by default; its users.info knows the name "Varun". */
export const PERSON = "U0PERSON";

export interface Setup {
  slack: FakeSlack;
  /** Runs the adapter with the Web API's URL, the token and the signing secret; `env` adds or replaces variables. */
  run(args: string[], env?: Record<string, string>): ReturnType<Sut["cli"]>;
  /** Runs the adapter, expects exit code 0, and gives the JSON of its one line. */
  json(args: string[]): Promise<Record<string, unknown>>;
  /** Writes the receiver's newest delivery to $INPUT/delivery.json as it got it, and gives the file's name. */
  delivery(): Promise<string>;
}

export async function setup(sut: Sut, fakes: Fakes): Promise<Setup> {
  const slack = await fakes.slack();
  const receiver = await fakes.http([
    { method: "POST", path: "/slack/events", body: {} },
    { method: "POST", path: "/slack/actions", body: {} },
  ]);
  slack.deliverTo(`${receiver.url}/slack/events`, `${receiver.url}/slack/actions`);
  const base = { CHANNEL_API_URL: slack.url, CHANNEL_TOKEN: slack.token, CHANNEL_SIGNING_SECRET: slack.signingSecret };
  const run = (args: string[], env: Record<string, string> = {}) => sut.cli(args, { env: { ...base, ...env } });
  return {
    slack,
    run,
    async json(args) {
      const result = await run(args);
      if (result.exitCode !== 0) throw new Error(`${args[0]} exited with ${result.exitCode}: ${result.stderr}`);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    },
    async delivery() {
      const index = receiver.headers().length - 1;
      const headers = receiver.headers()[index]?.headers;
      const body = receiver.texts()[index]?.text;
      await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers, body }));
      return "delivery.json";
    },
  };
}

/** The person's message in "C0WEB" that mentions the bot, as a delivery file. */
export async function mention(box: Setup, text = "Fix the checkout button on Safari", user = PERSON) {
  const message = await box.slack.say({ channel: CHANNEL, text: `<@${box.slack.bot}> ${text}`, user });
  return { message, file: await box.delivery() };
}

/** The thread of a work item that receive printed for the person's message. */
export async function thread(box: Setup): Promise<string> {
  const { file } = await mention(box);
  const printed = (await box.json(["receive", file])) as { workItem: { origin: { externalId: string } } };
  return printed.workItem.origin.externalId;
}
