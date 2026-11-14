import { scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, navLinks, open, serving, TOKEN_ROUTES } from "./console.ts";

scenario("SCN-CONSOLE-136", async ({ sut, fakes, given, when, then }) => {
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

  await then('the page answers 200 with the title "Health · console"', async () => {
    expect([page.status, page.title]).toEqual([200, "Health · console"]);
  });

  await then(
    'the page\'s navigation links "/", "/work", "/factory", "/inbox", "/improvement", "/health" and "https://grafana.acme.dev"',
    async () => {
      expect(navLinks(page)).toEqual([
        { href: "/", text: "Runs" },
        { href: "/work", text: "Work" },
        { href: "/factory", text: "Factory" },
        { href: "/inbox", text: "Inbox" },
        { href: "/improvement", text: "Cost and scores" },
        { href: "/health", text: "Health" },
        { href: "https://grafana.acme.dev", text: "Grafana" },
      ]);
    },
  );
});
