import { scenario } from "@opensoftware/testkit";
import { open, serving } from "./console.ts";

scenario("SCN-CONSOLE-028", async ({ sut, given, when, then }) => {
  let foremen: string[] = [];
  await given('"CONSOLE_FOREMAN_URL" is "http://127.0.0.1:1", where nothing listens', async () => {
    foremen = ["http://127.0.0.1:1"];
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, foremen);
    page = await open(sut, "/");
  });

  await then('the page answers 200 and says "the foreman at http://127.0.0.1:1 did not answer"', async () => {
    expect(page.status).toBe(200);
    expect(page.html).toContain('<p role="alert">the foreman at http://127.0.0.1:1 did not answer</p>');
  });
});
