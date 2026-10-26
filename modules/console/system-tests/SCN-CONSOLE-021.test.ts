import { scenario } from "@opensoftware/testkit";
import { foreman, open, RUN, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-021", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with a run whose stage "ship" failed with the reason "the check ci failed" and the check "ci" in the state "failure"',
    async () => {
      api = await foreman(fakes, [
        runOf("Export reports as CSV", {
          state: "failed",
          stages: [
            {
              stage: "ship",
              agent: "shipper",
              state: "failed",
              gateId: "g0123456789abcdef",
              checks: [
                { name: "ci", state: "failure" },
                { name: "lint", state: "success" },
              ],
              reason: "the check ci failed",
            },
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

  await then('the page shows the check "ci" as "failure"', async () => {
    expect(rows(page.html)[0]?.[5]).toBe("ci: failure, lint: success");
  });

  await then('the page shows the reason "the check ci failed"', async () => {
    expect(rows(page.html)[0]).toEqual([
      "ship",
      "shipper",
      "failed",
      "",
      "g0123456789abcdef",
      "ci: failure, lint: success",
      "the check ci failed",
    ]);
  });
});
