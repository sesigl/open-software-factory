import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-134", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_HARNESSES" naming "acp" as a JSON list whose program is a script in a folder "with space"',
    async () => {
      server = await serving(sut, fakes, { harnessIn: "$OUTPUT/with space/acp.sh" });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('the run completes and the scripted harness got a session for "plan" and for "implement"', async () => {
    const view = await server.until(runId, "complete");
    expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "succeeded"]);
    expect(server.harness.sessions()).toHaveLength(2);
  });
});
