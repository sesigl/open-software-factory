import { scenario } from "@opensoftware/testkit";
import { putReadme, slackEnv } from "./gate.ts";
import { putEach, type Run, requestArgs, runEach } from "./input.ts";

const groups = (maintainer: string) => ({ maintainers: [maintainer], reviewers: [maintainer], leads: ["slack:U0LEO"] });

scenario("SCN-GATE-106", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given(
    'the README policy and request, and the groups files "email.json" whose "maintainers" is "ada@acme.dev" and "at.json" whose "maintainers" is "ada@"',
    async () => {
      await putReadme(sut, fakes);
      await putEach(sut, { "email.json": groups("ada@acme.dev"), "at.json": groups("ada@") });
    },
  );

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" with each groups file', async () => {
    runs = await runEach(
      sut,
      ["email.json", "at.json"],
      (file) => requestArgs("policy.rego", file),
      () => env,
    );
  });

  await then("the commands exit with the codes 0 and 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([0, 2]);
  });

  await then(
    'the outputs say "gate <gate> asks maintainers in slack:C0GATES (risk high)" and that "at.json" must map each group to its members',
    async () => {
      expect(runs.map((run) => run.stdout + run.stderr)).toEqual([
        expect.stringMatching(/^gate g[0-9a-f]{16} asks maintainers in slack:C0GATES \(risk high\)\n$/),
        'gatekeeper: at.json must map each group to its members, like {"maintainers": ["slack:U0ADA"]}\n',
      ]);
    },
  );
});
