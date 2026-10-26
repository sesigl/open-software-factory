import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-025", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_HARNESSES" naming a program that does not exist',
    async () => {
      server = await serving(sut, fakes, {
        env: { FOREMAN_HARNESSES: JSON.stringify({ acp: "osf-no-such-harness" }) },
      });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "failed" },
        { stage: "implement", state: "pending" },
      ]);
    },
  );
});
