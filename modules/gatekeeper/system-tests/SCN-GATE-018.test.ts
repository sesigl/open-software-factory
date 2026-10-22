import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-018", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    run = await sut.cli(["status", ...GATE], { env: setup.env });
  });

  await then("the command exits with code 3", async () => {
    expect(run.exitCode, run.stderr).toBe(3);
  });

  await then('the output says "waiting for maintainers"', async () => {
    expect(run.stdout).toMatch(/^gate g[0-9a-f]{16} waiting for maintainers$/m);
    expect(replies(setup.slack, setup.message)).toEqual([]);
  });
});
