import { scenario } from "@opensoftware/testkit";
import { open, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-008", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof fakes.http>>;
  await given('a foreman whose API answers "/v1/runs?state=failed" with the run "Fix login"', async () => {
    const failed = runOf("Fix login", { state: "failed", endedAt: "2025-12-31T23:58:00.000Z" });
    api = await fakes.http([{ path: "/v1/runs?state=failed", body: { runs: [failed] } }]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/?state=failed"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/?state=failed");
  });

  await then('the page lists only the run "Fix login" in the state "failed"', async () => {
    expect(rows(page.html).map((row) => [row[0], row[2]])).toEqual([["Fix login", "failed"]]);
    expect(page.html).toContain('<a href="?state=failed" aria-current="page">failed</a>');
  });

  await then('the console asked the foreman for "/v1/runs?state=failed"', async () => {
    expect(api.requests()).toEqual(["GET /v1/runs?state=failed"]);
  });
});
