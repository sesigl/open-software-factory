import { scenario } from "@opensoftware/testkit";
import { factoryEnv } from "./console.ts";

scenario("SCN-CONSOLE-039", async ({ sut, given, when, then }) => {
  const url = "http://127.0.0.1:1";
  let env: Record<string, string> = {};
  await given('"CONSOLE_FOREMAN_URL" names a port where nothing listens', async () => {
    env = { CONSOLE_FOREMAN_URL: url, CONSOLE_FOREMAN_TOKEN: "foreman-token", ...(await factoryEnv(sut)) };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  foreman: no answer at <URL>: check CONSOLE_FOREMAN_URL and that foreman runs"',
    async () => {
      expect(run.stdout).toContain(
        `FAIL  foreman: no answer at ${url}: check CONSOLE_FOREMAN_URL and that foreman runs\n`,
      );
    },
  );
});
