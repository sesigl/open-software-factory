import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

/** The value of a line `<name>=<value>` of a .env. */
const setting = (env: string, name: string) => new RegExp(`^${name}=(.*)$`, "m").exec(env)?.[1];

scenario("SCN-REPO-170", async ({ sut, given, when, then }) => {
  await given('a "deploy/compose/.env.example" with "CONSOLE_SESSION_SECRET=" and "CONSOLE_SIGNING_KEY="', async () => {
    await sut.files.put(`$INPUT/${EXAMPLE}`, "CONSOLE_SESSION_SECRET=\nCONSOLE_SIGNING_KEY=\n");
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
    '"deploy/compose/.env" sets "CONSOLE_SIGNING_KEY" to 64 hex digits, another value than "CONSOLE_SESSION_SECRET"',
    async () => {
      expect(setting(env, "CONSOLE_SIGNING_KEY"), env).toMatch(/^[0-9a-f]{64}$/);
      expect(setting(env, "CONSOLE_SIGNING_KEY")).not.toBe(setting(env, "CONSOLE_SESSION_SECRET"));
    },
  );

  let again: Awaited<ReturnType<typeof sut.cli>>;
  let after = "";
  await when(
    'the developer removes the line of "CONSOLE_SIGNING_KEY" from ".env" and runs "osf init" again',
    async () => {
      await sut.files.put(`$INPUT/${ENV}`, env.replace(/^CONSOLE_SIGNING_KEY=.*\n?/m, ""));
      again = await sut.cli(["init"]);
      after = await sut.files.read(`$INPUT/${ENV}`);
    },
  );

  await then('the output contains "deploy/compose/.env exists: kept it, and added CONSOLE_SIGNING_KEY"', async () => {
    expect(again.stdout).toContain("deploy/compose/.env exists: kept it, and added CONSOLE_SIGNING_KEY\n");
  });

  await then(
    '"deploy/compose/.env" keeps its "CONSOLE_SESSION_SECRET" and sets "CONSOLE_SIGNING_KEY" to a new value of 64 hex digits',
    async () => {
      expect(setting(after, "CONSOLE_SESSION_SECRET")).toBe(setting(env, "CONSOLE_SESSION_SECRET"));
      expect(setting(after, "CONSOLE_SIGNING_KEY"), after).toMatch(/^[0-9a-f]{64}$/);
      expect(setting(after, "CONSOLE_SIGNING_KEY")).not.toBe(setting(env, "CONSOLE_SIGNING_KEY"));
    },
  );
});
