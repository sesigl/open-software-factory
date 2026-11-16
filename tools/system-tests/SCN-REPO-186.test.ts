import { scenario } from "@opensoftware/testkit";
import { putAll, testedPackage } from "./repo.ts";

const RUN_TIME = '{"seconds":12.345}\n';

scenario("SCN-REPO-186", async ({ sut, given, when, then }) => {
  await given('a repository with the modules "demo" and "other"', async () => {
    await putAll(sut, {
      "pnpm-workspace.yaml": "packages:\n  - modules/*\n",
      ...testedPackage("demo"),
      ...testedPackage("other"),
    });
  });

  await given('"modules/demo/reports/run-time.json", which "testkit timed" wrote', async () => {
    await putAll(sut, { "modules/demo/reports/run-time.json": RUN_TIME });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf collect-reports"', async () => {
    run = await sut.cli(["collect-reports"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"reports/run-time/demo.json" has the content of the package\'s file, and there is no "reports/run-time/other.json"',
    async () => {
      expect(await sut.files.read("$INPUT/reports/run-time/demo.json")).toBe(RUN_TIME);
      expect(await sut.files.list("$INPUT")).not.toContain("reports/run-time/other.json");
    },
  );
});
