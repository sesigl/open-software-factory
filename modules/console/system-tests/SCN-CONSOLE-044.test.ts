import { scenario } from "@opensoftware/testkit";
import { foreman, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-044", async ({ sut, fakes, given, when, then }) => {
  let foremanUrl = "";
  await given('a console without "CONSOLE_INTAKE_URL"', async () => {
    foremanUrl = (await foreman(fakes, [])).url;
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/work"', async () => {
    await serving(sut, [foremanUrl]);
    page = await open(sut, "/work");
  });

  await then(
    'the page answers 404 and says "no work items: set CONSOLE_INTAKE_URL to the base URL of intake\'s API"',
    async () => {
      expect(page.status).toBe(404);
      expect(page.text).toContain("no work items: set CONSOLE_INTAKE_URL to the base URL of intake's API");
    },
  );
});
