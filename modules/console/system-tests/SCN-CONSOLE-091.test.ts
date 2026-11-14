import { scenario } from "@opensoftware/testkit";
import { navLinks, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-091", async ({ sut, given, when, then }) => {
  await given('"console serve" runs without "CONSOLE_IMPROVE_DIR"', async () => {
    await serving(sut, ["http://127.0.0.1:1"]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/improvement"', async () => {
    page = await open(sut, "/improvement");
  });

  await then(
    'the page answers 404 and says "no cost and scores: set CONSOLE_IMPROVE_DIR to the folder of the improvement jobs"',
    async () => {
      expect(page.status).toBe(404);
      expect(page.title).toBe("Cost and scores · console");
      expect(page.text).toContain("No cost and scores");
      expect(page.text).toContain("no cost and scores: set CONSOLE_IMPROVE_DIR to the folder of the improvement jobs");
    },
  );

  await then('the navigation does not link "/improvement"', async () => {
    expect(navLinks(page).map((link) => link.href)).not.toContain("/improvement");
  });
});
