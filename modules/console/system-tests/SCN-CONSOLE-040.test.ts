import { scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, navLinks, open, rows, serving, TOKEN_ROUTES } from "./console.ts";

scenario("SCN-CONSOLE-040", async ({ sut, fakes, given, when, then }) => {
  let foreman: Awaited<ReturnType<typeof healthyServer>>;
  await given("a foreman that refuses the console's token", async () => {
    foreman = await healthyServer(fakes, [{ name: "temporal", ok: true }], TOKEN_ROUTES.foreman, 401);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/health"', async () => {
    await serving(sut, [foreman.url], { CONSOLE_FOREMAN_TOKEN: "wrong-token", ...(await factoryEnv(sut)) });
    page = await open(sut, "/health");
  });

  await then("the page answers 503", async () => {
    expect(page.status).toBe(503);
  });

  await then(
    'its table has the row "foreman token", "failing", "foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN"',
    async () => {
      expect(rows(page)).toContainEqual([
        "foreman token",
        "failing",
        "foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN",
      ]);
      expect(rows(page)).toContainEqual(["foreman temporal", "ok", "—"]);
    },
  );

  await then('the page\'s navigation links "/health"', async () => {
    expect(navLinks(page)).toContainEqual({ href: "/health", text: "Health" });
  });
});
