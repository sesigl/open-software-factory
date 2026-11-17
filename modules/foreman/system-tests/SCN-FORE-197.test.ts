import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";

scenario("SCN-FORE-197", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "factory.yaml"', async () => {
    await committed(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "foreman serve" with "OSF_NOW" set to "2026-01-01T05:00:00Z" and "OSF_TEST_HOOKS" set to ""',
    async () => {
      run = await sut.cli(["serve"], {
        env: { FOREMAN_API_TOKEN: API_TOKEN, OSF_NOW: "2026-01-01T05:00:00Z", OSF_TEST_HOOKS: "" },
      });
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW"',
    async () => {
      expect(run.stderr).toContain(
        "OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW",
      );
    },
  );
});
