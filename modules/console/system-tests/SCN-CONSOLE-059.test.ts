import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-059", async ({ sut, given, when, then }) => {
  let file = "";
  await given('"CONSOLE_GROUPS" names a file that does not exist', async () => {
    file = sut.files.path("$INPUT/groups.json");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env: { CONSOLE_GROUPS: file } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    "it prints \"FAIL  groups: ENOENT: no such file or directory, open '<file>': check CONSOLE_GROUPS\"",
    async () => {
      expect(run.stdout).toContain(
        `FAIL  groups: ENOENT: no such file or directory, open '${file}': check CONSOLE_GROUPS\n`,
      );
    },
  );
});
