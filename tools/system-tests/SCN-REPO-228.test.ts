import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

/** The value of a line `<name>=<value>` of a .env. */
const setting = (env: string, name: string) => new RegExp(`^${name}=(.*)$`, "m").exec(env)?.[1];

scenario("SCN-REPO-228", async ({ sut, fakes, given, when, then }) => {
  await given('the "deploy/compose/.env.example" of this repository', async () => {
    await sut.files.put(`$INPUT/${EXAMPLE}`, fakes.fromRepository("deploy/compose")[".env.example"] as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  let env = "";
  await when('the developer runs "osf init"', async () => {
    run = await sut.cli(["init"]);
    env = await sut.files.read(`$INPUT/${ENV}`);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"deploy/compose/.env" sets "GATEKEEPER_SIGNING_KEY" to 64 hex digits, another value than "CONSOLE_SIGNING_KEY"',
    async () => {
      expect(setting(env, "GATEKEEPER_SIGNING_KEY"), env).toMatch(/^[0-9a-f]{64}$/);
      expect(setting(env, "CONSOLE_SIGNING_KEY")).toMatch(/^[0-9a-f]{64}$/);
      expect(setting(env, "GATEKEEPER_SIGNING_KEY")).not.toBe(setting(env, "CONSOLE_SIGNING_KEY"));
    },
  );
});
