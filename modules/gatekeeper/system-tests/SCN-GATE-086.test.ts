import { scenario } from "@opensoftware/testkit";
import { PR, putReadme } from "./gate.ts";
import { type Run, runEach } from "./input.ts";

const POLICY = ["--policy", "policy.rego"];
const GROUPS = ["--groups", "groups.json"];
const CHANNEL = ["--channel", "slack:C0GATES"];
const ARGS: Record<string, string[]> = {
  "name the policy, like --policy policy.rego": [...GROUPS, ...CHANNEL, "request.json"],
  "name the groups, like --groups groups.json": [...POLICY, ...CHANNEL, "request.json"],
  "name one request file": [...POLICY, ...GROUPS, ...CHANNEL, "request.json", "request.json"],
  "name a request file or --pull-request, not both": [...POLICY, ...GROUPS, "--pull-request", PR, "request.json"],
  "name a request file, or use --pull-request": [...POLICY, ...GROUPS, ...CHANNEL],
  "name the channel, like --channel slack:C0GATES": [...POLICY, ...GROUPS, "request.json"],
};

scenario("SCN-GATE-086", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper request" without "--policy", without "--groups", with two request files, with a request file and "--pull-request", without a request file, and without "--channel"',
    async () => {
      runs = await runEach(sut, Object.keys(ARGS), (line) => ["request", ...(ARGS[line] as string[])]);
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  await then(
    'the error outputs say "name the policy, like --policy policy.rego", "name the groups, like --groups groups.json", "name one request file", "name a request file or --pull-request, not both", "name a request file, or use --pull-request" and "name the channel, like --channel slack:C0GATES"',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(Object.keys(ARGS).map((line) => `gatekeeper: ${line}\n`));
    },
  );
});
