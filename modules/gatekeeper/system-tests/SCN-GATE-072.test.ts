import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { putEach, type Run, readmeRequestWith, requestArgs, runEach, usageLines } from "./input.ts";

const FILES = {
  "upper.json": readmeRequestWith({ stage: "Merge" }),
  "sign.json": readmeRequestWith({ stage: "merge!" }),
  "number.json": readmeRequestWith({ stage: 7 }),
};

scenario("SCN-GATE-072", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the requests "upper.json" with the stage "Merge", "sign.json" with the stage "merge!" and "number.json" with the stage 7',
    async () => {
      await putEach(sut, FILES);
    },
  );

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request', async () => {
    runs = await runEach(sut, Object.keys(FILES), (file) => requestArgs("policy.rego", "groups.json", file));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
  });

  await then(
    'each error output says that the field "stage" of the request file must be a lowercase name like "merge"',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        usageLines(Object.keys(FILES), (file) => `${file}: the field "stage" must be a lowercase name like "merge"`),
      );
    },
  );
});
