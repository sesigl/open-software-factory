import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { putEach, type Run, readmeRequestWith, requestArgs, runEach, usageLines } from "./input.ts";

const FILES = {
  "number.json": readmeRequestWith({ workItem: 7 }),
  "empty.json": readmeRequestWith({ workItem: "" }),
  "long.json": readmeRequestWith({ workItem: "w".repeat(129) }),
};

scenario("SCN-GATE-071", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the requests "number.json" with the work item 7, "empty.json" with an empty work item and "long.json" with a work item of 129 characters',
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
    'each error output says that the field "workItem" of the request file must be a text of 1 to 128 characters',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        usageLines(Object.keys(FILES), (file) => `${file}: the field "workItem" must be a text of 1 to 128 characters`),
      );
    },
  );
});
