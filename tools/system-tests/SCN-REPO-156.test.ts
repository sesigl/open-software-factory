import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

scenario("SCN-REPO-156", async ({ sut, given, when, then }) => {
  await given('a "deploy/compose/.env.example" with "CONSOLE_SESSION_SECRET=" and "CONSOLE_SIGN_IN="', async () => {
    await sut.files.put(`$INPUT/${EXAMPLE}`, "CONSOLE_SESSION_SECRET=\nCONSOLE_SIGN_IN=\n");
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
    '"deploy/compose/.env" sets "CONSOLE_SESSION_SECRET" to 64 hex digits and keeps "CONSOLE_SIGN_IN=" empty',
    async () => {
      expect(env).toMatch(/^CONSOLE_SESSION_SECRET=[0-9a-f]{64}$/m);
      expect(env.split("\n")).toContain("CONSOLE_SIGN_IN=");
    },
  );
});
