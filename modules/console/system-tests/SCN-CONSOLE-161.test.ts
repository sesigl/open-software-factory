import { scenario } from "@opensoftware/testkit";
import { foreman, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-161", async ({ sut, fakes, given, when, then }) => {
  await given("a foreman with no runs", async () => {
    const api = await foreman(fakes, [], [{ path: "/v1/runs?state=failed", body: { runs: [] } }]);
    await serving(sut, [api.url]);
  });

  let light: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/?state=failed" and follows "Light theme"', async () => {
    const page = await open(sut, "/?state=failed");
    expect(page.theme).toBe("dark");
    light = await page.follow("Light theme");
  });

  await then('the page "/?state=failed" has the light theme and links "Dark theme"', async () => {
    expect([light.path, light.theme]).toEqual(["/?state=failed", "light"]);
    expect(light.queryByRole("link", { name: "Light theme" })).toBeUndefined();
  });

  await then('after "Dark theme" the page has the dark theme again', async () => {
    const dark = await light.follow("Dark theme");
    expect([dark.path, dark.theme]).toEqual(["/?state=failed", "dark"]);
  });
});
