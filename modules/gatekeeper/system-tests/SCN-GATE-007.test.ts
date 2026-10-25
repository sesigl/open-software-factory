import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, request, slackEnv } from "./gate.ts";

scenario("SCN-GATE-007", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(sut, fakes);
  await given('a policy whose "approvers" is empty for a change of "docs/guide.md"', async () => {
    await putReadme(sut, fakes, {
      "policy.rego": [
        "package gatekeeper",
        "",
        'approvers contains "maintainers" if {',
        "\tsome path in input.change.paths",
        '\tnot startswith(path, "docs/")',
        "}",
        "",
      ].join("\n"),
    });
  });

  await given('a request for a change of "docs/guide.md"', async () => {
    await sut.files.put("$INPUT/request.json", request(["docs/guide.md"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "approved by the policy"', async () => {
    expect(run.stdout).toMatch(/^gate g[0-9a-f]{16} approved by the policy: no approver group needed$/m);
  });

  await then('"$OUTPUT/record.json" has the decision "approved" by the trigger "policy:policy.rego"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/record.json"))).toMatchObject({
      decision: "approved",
      decidedBy: { kind: "trigger", id: "policy:policy.rego" },
      approvers: [],
    });
  });

  await then('the Slack channel "C0GATES" has no message', async () => {
    expect(slack.messages("C0GATES")).toEqual([]);
  });
});
