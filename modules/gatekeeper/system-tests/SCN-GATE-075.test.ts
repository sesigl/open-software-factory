import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { putEach, type Run, readmeRequestWith, requestArgs, runEach, usageLines } from "./input.ts";

const FILES = {
  "list.json": readmeRequestWith({ change: [] }),
  "text.json": readmeRequestWith({ change: "contracts/" }),
  "null.json": readmeRequestWith({ change: null }),
};

scenario("SCN-GATE-075", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the requests "list.json" with a list as change, "text.json" with a text as change and "null.json" with the change null',
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

  await then('each error output says that the field "change" of the request file must be a JSON object', async () => {
    expect(runs.map((run) => run.stderr)).toEqual(
      usageLines(Object.keys(FILES), (file) => `${file}: the field "change" must be a JSON object`),
    );
  });
});
