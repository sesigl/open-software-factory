import { scenario } from "@opensoftware/testkit";
import { readmeWork, SHIP, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-046", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub and a scripted harness whose turns name no pull request',
    async () => {
      server = await servingChecks(sut, fakes, { check: "success", linked: false });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "ship" "failed" and the reason "no earlier stage linked a pull request"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages[2]).toMatchObject({
        stage: "ship",
        state: "failed",
        reason: "no earlier stage linked a pull request",
      });
      expect(view.stages[2]?.checks).toBeUndefined();
      expect(view.pullRequest).toBeUndefined();
    },
  );

  await then('the harness never received the prompt "Merge the pull request"', async () => {
    expect(server.prompts(SHIP)).toEqual([]);
  });
});
