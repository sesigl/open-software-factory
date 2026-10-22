import { scenario } from "@opensoftware/testkit";
import { putSuiteAndHarbor } from "./harbor.ts";

scenario("SCN-TASK-048", async ({ sut, given, when, then }) => {
  await given(
    'a suite with the tasks "web-1" and "web-2" and "TASKCAPTURE_HARBOR" set to a file that does not exist',
    async () => {
      await putSuiteAndHarbor(sut, ["web-1", "web-2"]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture run --suite suite --agent oracle"', async () => {
    run = await sut.cli(["run", "--suite", "suite", "--agent", "oracle"], {
      env: { TASKCAPTURE_HARBOR: "./no-such-harbor" },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says to install Harbor with "uv tool install harbor" or to set "TASKCAPTURE_HARBOR"',
    async () => {
      expect(run.stderr).toContain("taskcapture: could not start ./no-such-harbor (ENOENT)");
      expect(run.stderr).toContain('install it with "uv tool install harbor" or set TASKCAPTURE_HARBOR');
    },
  );
});
