import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { putEach, type Run, requestArgs, runEach, usageLines } from "./input.ts";

const FILES = { "list.json": "[]", "null.json": "null", "text.json": '"merge"' };

scenario("SCN-GATE-076", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given('the request files "list.json" with [], "null.json" with null and "text.json" with "merge"', async () => {
    await putEach(sut, FILES);
  });

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request', async () => {
    runs = await runEach(sut, Object.keys(FILES), (file) => requestArgs("policy.rego", "groups.json", file));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
  });

  await then("each error output says that the request file is no JSON object", async () => {
    expect(runs.map((run) => run.stderr)).toEqual(
      usageLines(Object.keys(FILES), (file) => `${file} is no JSON object`),
    );
  });
});
