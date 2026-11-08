import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFLITE-006", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "inference-litellm" without a command', async () => {
    run = await sut.cli([]);
  });

  await then(
    'it exits with code 2 and prints "Usage: inference-litellm <command>" and the commands on standard error',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toMatch(/^Usage: inference-litellm <command>\n/);
      for (const command of ["start", "key", "spend-log", "stop", "list"]) {
        expect(run.stderr).toMatch(new RegExp(`^ {2}${command} `, "m"));
      }
    },
  );

  await then("it prints nothing on standard output", async () => {
    expect(run.stdout).toBe("");
  });
});
