import { scenario } from "@opensoftware/testkit";
import { foreman, open, RUN, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-055", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with a run whose stage "verify" has no agent and succeeded', async () => {
    api = await foreman(fakes, [
      runOf("Add diagnostics to cloud agent runs", { stages: [{ stage: "verify", state: "succeeded" }] }),
    ]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when("a person opens the run's page", async () => {
    await serving(sut, [api.url]);
    page = await open(sut, `/runs/${RUN}`);
  });

  await then('the page shows the stage "verify" with "waits" in the column of the agent, as "succeeded"', async () => {
    expect(page.status).toBe(200);
    expect(rows(page.html)[0]).toEqual(["verify", "waits", "succeeded", "", "", "", ""]);
  });

  await then('the page does not contain "undefined"', async () => {
    expect(page.html).not.toContain("undefined");
  });
});
