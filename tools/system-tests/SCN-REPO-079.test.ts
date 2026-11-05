import { scenario } from "@opensoftware/testkit";
import { putAll, testedPackage } from "./repo.ts";

const JUNIT = '<testsuites><testsuite name="demo"><testcase name="SCN-DEMO-001"/></testsuite></testsuites>\n';
const COVERAGE = '{"result":[]}\n';

scenario("SCN-REPO-079", async ({ sut, given, when, then }) => {
  await given('a repository with the modules "demo" and "other"', async () => {
    await putAll(sut, {
      "pnpm-workspace.yaml": "packages:\n  - modules/*\n",
      ...testedPackage("demo"),
      ...testedPackage("other"),
    });
  });

  await given(
    '"modules/demo/reports/junit.xml" and the coverage file "modules/demo/reports/coverage/coverage-7-1-0.json"',
    async () => {
      await putAll(sut, {
        "modules/demo/reports/junit.xml": JUNIT,
        "modules/demo/reports/coverage/coverage-7-1-0.json": COVERAGE,
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf collect-reports"', async () => {
    run = await sut.cli(["collect-reports"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"reports/junit/demo.xml" and "reports/coverage/demo-coverage-7-1-0.json" have the content of the package\'s files',
    async () => {
      expect(await sut.files.read("$INPUT/reports/junit/demo.xml")).toBe(JUNIT);
      expect(await sut.files.read("$INPUT/reports/coverage/demo-coverage-7-1-0.json")).toBe(COVERAGE);
    },
  );
});
