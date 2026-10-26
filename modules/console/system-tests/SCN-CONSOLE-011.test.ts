import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, runOf, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-011", async ({ sut, fakes, given, when, then }) => {
  let web: Awaited<ReturnType<typeof foreman>>;
  let second: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a foreman of the factory "web" with the run "Export reports as CSV" and a second foreman that answers 503',
    async () => {
      web = await foreman(fakes, [runOf("Export reports as CSV")]);
      second = await fakes.http([{ path: "/v1/runs", status: 503, body: { title: "Unavailable" } }]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, [web.url, second.url]);
    page = await open(sut, "/");
  });

  await then('the page answers 200 and lists the run "Export reports as CSV"', async () => {
    expect(page.status).toBe(200);
    expect(rows(page.html).map((row) => row[0])).toEqual(["Export reports as CSV"]);
  });

  await then('the page says "the foreman at <second URL> did not answer: 503"', async () => {
    expect(page.html).toContain(`<p role="alert">the foreman at ${second.url} did not answer: 503</p>`);
    expect(text(page.html)).not.toContain(`the foreman at ${web.url}`);
  });
});
