import { scenario } from "@opensoftware/testkit";
import { foreman, open, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-010", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given("a foreman with no runs", async () => {
    api = await foreman(fakes, []);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/?state=merged"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/?state=merged");
  });

  await then(
    'the page answers 400 and says "no state merged: running, blocked, complete, failed or cancelled"',
    async () => {
      expect(page.status).toBe(400);
      expect(text(page.html)).toContain("no state merged: running, blocked, complete, failed or cancelled");
    },
  );

  await then("the console did not ask the foreman", async () => {
    expect(api.requests()).toEqual([]);
  });
});
