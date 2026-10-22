import { scenario } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

scenario("SCN-GATE-038", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0ADA" of "maintainers" replied "approve" in its thread', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0ADA", threadTs: setup.message.ts });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with "GATEKEEPER_SIGNING_KEY" set to "not a key"', async () => {
    run = await sut.cli(["status", ...GATE], { env: { ...setup.env, GATEKEEPER_SIGNING_KEY: "not a key" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the error output says "GATEKEEPER_SIGNING_KEY is no private key in PEM"', async () => {
    expect(run.stderr).toBe("gatekeeper: GATEKEEPER_SIGNING_KEY is no private key in PEM\n");
  });

  await then('the output folder has no "record.json"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("record.json");
  });
});
