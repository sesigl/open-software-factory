import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-016", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0EVE", who is in no group, replied "approve" in its thread', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0EVE", threadTs: setup.message.ts });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    run = await sut.cli(["status", ...GATE], { env: setup.env });
  });

  await then("the command exits with code 3", async () => {
    expect(run.exitCode, run.stderr).toBe(3);
  });

  await then('the thread has the reply "<@U0EVE> is not in maintainers"', async () => {
    expect(replies(setup.slack, setup.message)).toEqual([
      "approve",
      expect.stringMatching(
        /^<@U0EVE> is not in maintainers, so this decision does not count\.\n\[gatekeeper g[0-9a-f]{16} refused 1767225600\.000002\]$/,
      ),
    ]);
  });

  await then('the output folder has no "record.json"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("record.json");
  });
});
