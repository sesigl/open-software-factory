import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, runOf } from "./console.ts";

scenario("SCN-CONSOLE-001", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman whose API has the run "Export reports as CSV"', async () => {
    api = await foreman(fakes, [runOf("Export reports as CSV")]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('the user starts "console serve" as the README says and opens "/"', async () => {
    await sut.http.start(["serve"], { env: { CONSOLE_FOREMAN_URL: api.url, CONSOLE_FOREMAN_TOKEN: "dev-token" } });
    page = await open(sut, "/");
  });

  await then('the page answers 200 and lists the run "Export reports as CSV" in the state "running"', async () => {
    expect(page.status).toBe(200);
    expect(rows(page.html)).toEqual([["Export reports as CSV", "web", "running", "slack", "Varun", "—", "5 min"]]);
  });

  await then('the page\'s stylesheet "/pico.css" answers 200', async () => {
    expect(page.html).toContain('<link rel="stylesheet" href="/pico.css"/>');
    const css = await sut.http.get("/pico.css");
    expect(css.status).toBe(200);
    expect(css.headers["content-type"]).toMatch(/^text\/css/);
    expect(String(css.body)).toContain("Pico CSS");
  });
});
