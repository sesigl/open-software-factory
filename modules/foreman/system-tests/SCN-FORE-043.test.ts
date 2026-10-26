import { scenario } from "@opensoftware/testkit";
import { readmeWork, SHIP, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-043", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the check "verify" in the state "success"',
    async () => {
      server = await servingChecks(sut, fakes, { check: "success" });
    },
  );
  await given('the scripted "implement" turn replies with the link of that pull request', async () => {
    expect(server.pr.number).toBe(1);
  });

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stage "ship" "succeeded" and its check "verify" "success"',
    async () => {
      const view = await server.until(runId, "complete");
      expect(view.stages[2]).toMatchObject({
        stage: "ship",
        state: "succeeded",
        checks: [{ name: "verify", state: "success" }],
      });
      expect(view.stages[2]?.reason).toBeUndefined();
    },
  );

  await then('the prompt of the "ship" stage names the pull request\'s link', async () => {
    const [prompt] = server.prompts(SHIP);
    expect(prompt).toContain(`\n\nPull request: ${server.pr.url}\n`);
    expect(server.prompts("Implement plan.md")[0]).not.toContain("Pull request:");
  });
});
