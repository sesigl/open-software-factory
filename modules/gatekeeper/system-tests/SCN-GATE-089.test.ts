import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { type Run, runEach } from "./input.ts";
import { API_TOKEN, SERVE } from "./server.ts";

// No server starts: each setting stops it before it opens the database.
const ENV: Record<string, string> = {
  GATEKEEPER_DATABASE_URL: "postgres://gatekeeper@127.0.0.1:1/gatekeeper",
  GATEKEEPER_API_TOKEN: API_TOKEN,
  GATEKEEPER_SLACK_TOKEN: "testkit-slack-token",
  GATEKEEPER_SLACK_SIGNING_SECRET: "testkit-signing-secret",
};
const CHANNEL = "serve needs a Slack channel, like --channel slack:C0GATES";
const without = (name: string) => Object.fromEntries(Object.entries(ENV).filter(([key]) => key !== name));
const onChannel = (channel: string) => SERVE.map((arg) => (arg === "slack:C0GATES" ? channel : arg));
const RUNS: { args: string[]; env: Record<string, string>; line: string }[] = [
  { args: onChannel("slack:c0gates"), env: ENV, line: CHANNEL },
  { args: onChannel("xslack:C0GATES"), env: ENV, line: CHANNEL },
  { args: onChannel("slack:C0GATES#x"), env: ENV, line: CHANNEL },
  {
    args: SERVE,
    env: without("GATEKEEPER_API_TOKEN"),
    line: "set GATEKEEPER_API_TOKEN: the token that callers of the API send",
  },
  { args: SERVE, env: without("GATEKEEPER_SLACK_TOKEN"), line: "set GATEKEEPER_SLACK_TOKEN: the Slack bot token" },
  {
    args: SERVE,
    env: without("GATEKEEPER_SLACK_SIGNING_SECRET"),
    line: "set GATEKEEPER_SLACK_SIGNING_SECRET: the signing secret of the Slack app",
  },
  {
    args: SERVE,
    env: { ...ENV, GATEKEEPER_SIGNING_KEY: "not a key" },
    line: "GATEKEEPER_SIGNING_KEY is no private key in PEM",
  },
];

scenario("SCN-GATE-089", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper serve" for the channels "slack:c0gates", "xslack:C0GATES" and "slack:C0GATES#x", and for "slack:C0GATES" without "GATEKEEPER_API_TOKEN", without "GATEKEEPER_SLACK_TOKEN", without "GATEKEEPER_SLACK_SIGNING_SECRET" and with "GATEKEEPER_SIGNING_KEY" set to "not a key"',
    async () => {
      const at = (item: string) => RUNS[Number(item)] as (typeof RUNS)[number];
      runs = await runEach(
        sut,
        RUNS.map((_, index) => String(index)),
        (item) => at(item).args,
        (item) => at(item).env,
      );
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual(RUNS.map(() => 2));
  });

  await then(
    'the error outputs say "serve needs a Slack channel, like --channel slack:C0GATES" three times, then "set GATEKEEPER_API_TOKEN", "set GATEKEEPER_SLACK_TOKEN", "set GATEKEEPER_SLACK_SIGNING_SECRET" and "GATEKEEPER_SIGNING_KEY is no private key in PEM"',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(RUNS.map(({ line }) => `gatekeeper: ${line}\n`));
    },
  );
});
