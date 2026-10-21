import { scenario } from "@opensoftware/testkit";

scenario("SCN-LEDGER-050", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger import https://github.com/acme"', async () => {
    run = await sut.cli(["import", "https://github.com/acme"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then(
    'the error output says "https://github.com/acme: not a repository URL like https://github.com/acme/web"',
    async () => {
      expect(run.stderr).toContain("https://github.com/acme: not a repository URL like https://github.com/acme/web");
    },
  );
});
