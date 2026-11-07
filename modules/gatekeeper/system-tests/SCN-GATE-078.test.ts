import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { expectUsageErrors, putEach, type Run, requestArgs, runEach } from "./input.ts";

const FILES = {
  "empty.rego": "package gatekeeper\n",
  "other.rego": 'package other\n\napprovers contains "maintainers"\n',
};

scenario("SCN-GATE-078", async ({ sut, fakes, given, when, then }) => {
  await given("the README groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the policies "empty.rego" with only the line "package gatekeeper" and "other.rego" with its rules in the package "other"',
    async () => {
      await putEach(sut, FILES);
    },
  );

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" with each policy', async () => {
    runs = await runEach(sut, Object.keys(FILES), (policy) => requestArgs(policy));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2]);
  });

  await then("each error output says that the policy has no rules in the package gatekeeper", async () => {
    expectUsageErrors(runs, Object.keys(FILES), (policy) => `${policy} has no rules in the package gatekeeper`);
  });
});
