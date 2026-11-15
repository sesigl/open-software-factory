import { scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, navLinks, open, serving, TOKEN_ROUTES } from "./console.ts";

scenario("SCN-CONSOLE-262", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  let foreman = "";
  await given(
    'a healthy console with an intake, the inbox of "tester/web", a folder of cost and scores and the dashboard "Grafana" at "https://grafana.acme.dev"',
    async () => {
      foreman = (await healthyServer(fakes, [], TOKEN_ROUTES.foreman)).url;
      const intake = await healthyServer(fakes, [], TOKEN_ROUTES.intake);
      env = {
        CONSOLE_INTAKE_URL: intake.url,
        CONSOLE_INBOX_REPOSITORY: "tester/web",
        CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve"),
        CONSOLE_LINKS: "Grafana=https://grafana.acme.dev",
        ...(await factoryEnv(sut)),
      };
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/health"', async () => {
    await serving(sut, [foreman], env);
    page = await open(sut, "/health");
  });

  await then(
    'the page answers 200 with the title "Health · Open Software Factory" and the heading "Health"',
    async () => {
      expect([page.status, page.title]).toEqual([200, "Health · Open Software Factory"]);
      expect(page.getByRole("heading", { level: 1 }).text).toBe("Health");
    },
  );

  await then(
    'the page\'s navigation links "/", "/work", "/inbox", "/skills", "/factory", "/improvement", "/health" and "https://grafana.acme.dev", with "Health" as the current page',
    async () => {
      expect(navLinks(page).map((link) => link.href)).toEqual([
        "/",
        "/work",
        "/inbox",
        "/skills",
        "/factory",
        "/improvement",
        "/health",
        "https://grafana.acme.dev",
      ]);
      const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
      expect([current.attribute("href"), current.text]).toEqual(["/health", "Health"]);
    },
  );
});
