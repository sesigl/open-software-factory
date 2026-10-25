import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, request, slackEnv } from "./gate.ts";

scenario("SCN-GATE-004", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(sut, fakes);
  await given('the README policy, which gives the risk "high" to a change of a path below "contracts/"', async () => {
    await putReadme(sut, fakes);
  });

  await given('a request for a change of "contracts/score.tsp"', async () => {
    await sut.files.put("$INPUT/request.json", request(["contracts/score.tsp"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the Slack channel "C0GATES" has a message that asks "maintainers" to approve the change with the risk "high"',
    async () => {
      expect(slack.messages("C0GATES").map((message) => message.text)).toEqual([
        expect.stringContaining("Approval needed from maintainers (risk high): Merge it"),
      ]);
    },
  );

  await then('"$OUTPUT/gate.json" names the approver group "maintainers" and the risk "high"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/gate.json"))).toMatchObject({
      approvers: ["maintainers"],
      risk: "high",
      channel: "slack:C0GATES",
    });
  });
});
