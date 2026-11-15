import { scenario } from "@opensoftware/testkit";
import { unreachableEnv } from "./changes.ts";
import { foreman } from "./console.ts";

scenario("SCN-CONSOLE-223", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a console with "CONSOLE_FACTORY_REPOSITORY" and without "CONSOLE_FACTORY_USER"', async () => {
    const api = await foreman(fakes, []);
    const { CONSOLE_FACTORY_USER: _user, ...repository } = unreachableEnv(sut);
    env = { CONSOLE_FOREMAN_URL: api.url, ...repository };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console serve"', async () => {
    run = await sut.cli(["serve"], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('it prints "set CONSOLE_FACTORY_USER to the user of CONSOLE_FACTORY_TOKEN"', async () => {
    expect(run.stderr).toContain("set CONSOLE_FACTORY_USER to the user of CONSOLE_FACTORY_TOKEN");
  });
});
