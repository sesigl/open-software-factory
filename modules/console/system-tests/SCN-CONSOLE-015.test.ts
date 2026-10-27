import { scenario } from "@opensoftware/testkit";
import { foreman, open, RUN, rows, runOf, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-015", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with the run "Add diagnostics to cloud agent runs" whose stage "plan" succeeded and whose stage "implement" runs',
    async () => {
      api = await foreman(fakes, [
        runOf("Add diagnostics to cloud agent runs", {
          stages: [
            { stage: "plan", agent: "planner", state: "succeeded" },
            { stage: "implement", agent: "developer", state: "running" },
          ],
        }),
      ]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when("a person opens the run's page", async () => {
    await serving(sut, [api.url]);
    page = await open(sut, `/runs/${RUN}`);
  });

  await then('the page shows the stage "plan" of the agent "planner" as "succeeded"', async () => {
    expect(page.status).toBe(200);
    expect(rows(page.html)[0]).toEqual(["plan", "planner", "succeeded", "", "", "", ""]);
  });

  await then('the page shows the stage "implement" of the agent "developer" as "running"', async () => {
    expect(rows(page.html)[1]).toEqual(["implement", "developer", "running", "", "", "", ""]);
  });

  await then('the page shows the factory version "0a1b2c3"', async () => {
    expect(text(page.html)).toContain(`Run ${RUN} State running Factory web at 0a1b2c3 Age 5 min`);
  });
});
