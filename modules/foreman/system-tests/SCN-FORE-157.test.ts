import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";

scenario("SCN-FORE-157", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the README\'s "factory.yaml" is committed in a Git repository that the server reaches at a "file://" URL',
    async () => {
      await committed(sut, fakes);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve" with "FOREMAN_FACTORY" set to "git+<url>#no-such-branch"', async () => {
    const url = `file://${sut.files.path("$INPUT")}`;
    run = await sut.cli(["serve"], {
      env: {
        FOREMAN_API_TOKEN: API_TOKEN,
        FOREMAN_FACTORY: `git+${url}#no-such-branch`,
        OSF_DATA: sut.files.path("$OUTPUT/data"),
      },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the output contains "FOREMAN_FACTORY: cannot fetch no-such-branch of file://"', async () => {
    expect(run.stderr).toContain("FOREMAN_FACTORY: cannot fetch no-such-branch of file://");
  });
});
