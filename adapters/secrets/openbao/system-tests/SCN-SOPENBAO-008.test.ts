import { scenario } from "@opensoftware/testkit";

scenario("SCN-SOPENBAO-008", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "delete linear-token team/linear-token"', async () => {
    run = await sut.cli(["delete", "linear-token", "team/linear-token"]);
  });

  await then("delete exits with code 2 and prints the usage on standard error", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toMatch(/^Usage: secrets-openbao <command>\n/);
    expect(run.stderr).toContain("delete <name>");
    expect(run.stdout).toBe("");
  });
});
