import { scenario } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

scenario("SCN-GATE-006", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given("the README policy and groups", async () => {});

  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the same request again', async () => {
    run = await sut.cli(["request", ...GATE], { env: setup.env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "already requested"', async () => {
    expect(run.stdout).toMatch(/^gate g[0-9a-f]{16} already requested in slack:C0GATES$/m);
  });

  await then('the Slack channel "C0GATES" has one approval request', async () => {
    expect(setup.slack.messages("C0GATES").filter((message) => message.text.includes("Approval needed"))).toHaveLength(
      1,
    );
  });
});
