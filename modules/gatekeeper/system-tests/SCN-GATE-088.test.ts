import { scenario } from "@opensoftware/testkit";
import { putReadme, request, slackEnv } from "./gate.ts";
import { putEach, type Run, requestArgs, runEach } from "./input.ts";

scenario("SCN-GATE-088", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given(
    'the README policy, groups and request, and a policy "plain.rego" that asks "maintainers" without a risk',
    async () => {
      await putReadme(sut, fakes);
      await putEach(sut, {
        "plain.rego": 'package gatekeeper\n\napprovers contains "maintainers"\n',
        "guide.json": request(["docs/guide.md"]),
      });
    },
  );

  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper request" for the channel "slack:C0GATES" with the README files, and with "plain.rego" for a change of "docs/guide.md"',
    async () => {
      runs = await runEach(
        sut,
        ["policy.rego", "plain.rego"],
        (policy) => requestArgs(policy, "groups.json", policy === "plain.rego" ? "guide.json" : "request.json"),
        () => env,
      );
    },
  );

  await then("each command exits with code 0", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([0, 0]);
  });

  await then(
    'the outputs say "gate <gate> asks maintainers in slack:C0GATES (risk high)" and "gate <gate> asks maintainers in slack:C0GATES"',
    async () => {
      expect(runs.map((run) => run.stdout)).toEqual([
        expect.stringMatching(/^gate g[0-9a-f]{16} asks maintainers in slack:C0GATES \(risk high\)\n$/),
        expect.stringMatching(/^gate g[0-9a-f]{16} asks maintainers in slack:C0GATES\n$/),
      ]);
    },
  );
});
