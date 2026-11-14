import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, runOf } from "./console.ts";

scenario("SCN-CONSOLE-157", async ({ sut, fakes, given, when, then }) => {
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
    expect(rows(page)).toEqual([["Export reports as CSV", "web", "running", "slack", "Varun", "—", "5 min"]]);
  });

  await then(
    "each stylesheet of the page is a file of the console that answers 200 as CSS, one of them with the design system's tokens",
    async () => {
      expect(page.stylesheets.length).toBeGreaterThan(0);
      const answers = await Promise.all(page.stylesheets.map((path) => sut.http.get(path)));
      expect(page.stylesheets.every((path) => path.startsWith("/_astro/"))).toBe(true);
      expect(answers.map((answer) => [answer.status, answer.headers["content-type"]])).toEqual(
        answers.map(() => [200, "text/css; charset=utf-8"]),
      );
      expect(answers.some((answer) => String(answer.body).includes("--osf-signal:"))).toBe(true);
    },
  );

  await then("a file of the console's build that does not exist answers 404", async () => {
    expect((await sut.http.get("/_astro/missing.css")).status).toBe(404);
  });
});
