import { scenario } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

/** The seed of an Ed25519 key in 64 hex digits, made up for the test. */
const SEED = "5eed".repeat(16);
/** The public key of that seed in PEM, as the README's command prints it. */
const PUBLIC =
  "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAlW4zmAKH3ZvWpUaw9UO78RQpX8fUhVcP0vvuEaUxS0w=\n-----END PUBLIC KEY-----\n";

scenario("SCN-GATE-114", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a record that "gatekeeper status" wrote with "GATEKEEPER_SIGNING_KEY" set to the seed of an Ed25519 key in 64 hex digits',
    async () => {
      const setup = await requested(sut, fakes);
      await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0ADA", threadTs: setup.message.ts });
      const env = { ...setup.env, GATEKEEPER_SIGNING_KEY: SEED };
      const status = await sut.cli(["status", ...GATE, "--record", "record.json"], { env });
      expect(status.exitCode, status.stderr).toBe(0);
      expect(status.stderr).not.toContain("not signed");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "gatekeeper verify --public-key seed.pub record.json" with the public key of that seed in PEM',
    async () => {
      await sut.files.put("$INPUT/seed.pub", PUBLIC);
      run = await sut.cli(["verify", "--public-key", "seed.pub", "record.json"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "verified: approved by slack:U0ADA"', async () => {
    expect(run.stdout).toBe("record.json verified: approved by slack:U0ADA at 2026-01-01T00:00:00.000002Z\n");
  });
});
