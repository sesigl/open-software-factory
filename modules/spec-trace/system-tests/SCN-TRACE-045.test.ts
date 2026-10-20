import { scenario } from "@opensoftware/testkit";
import { readReport, traced } from "./repo.ts";

scenario("SCN-TRACE-045", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --out build/trace.json"', async () => {
    run = await sut.cli(["report", "--out", "build/trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the file "build/trace.json" in the working folder lists "SCN-SHOP-001"', async () => {
    const report = await readReport(sut, "$INPUT/build/trace.json");
    expect(report.scenarios.map((entry) => entry.id)).toEqual(["SCN-SHOP-001"]);
  });
});
