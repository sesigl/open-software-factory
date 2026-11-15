import { scenario } from "@opensoftware/testkit";
import { foreman } from "./console.ts";

scenario("SCN-CONSOLE-222", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a console whose "CONSOLE_FACTORY_REPOSITORY" is "https://forge.acme.dev/acme/factory"', async () => {
    const api = await foreman(fakes, []);
    env = {
      CONSOLE_FOREMAN_URL: api.url,
      CONSOLE_FACTORY_REPOSITORY: "https://forge.acme.dev/acme/factory",
      CONSOLE_FACTORY_USER: "forgejo:factory-bot",
    };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console serve"', async () => {
    run = await sut.cli(["serve"], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('it prints "CONSOLE_FACTORY_REPOSITORY is git+<url>#<branch> of the factory\'s repository"', async () => {
    expect(run.stderr).toContain("CONSOLE_FACTORY_REPOSITORY is git+<url>#<branch> of the factory's repository");
  });
});
