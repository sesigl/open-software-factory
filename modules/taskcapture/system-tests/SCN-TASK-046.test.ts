import { scenario } from "@opensoftware/testkit";
import { flag, harborCalls, putSuiteAndHarbor, runWithHarbor } from "./harbor.ts";
import { readJson } from "./results.ts";

scenario("SCN-TASK-046", async ({ sut, given, when, then }) => {
  await given('a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial', async () => {
    await putSuiteAndHarbor(sut, ["web-1", "web-2"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture run --suite suite --agent oracle"', async () => {
    run = await runWithHarbor(sut, ["run", "--suite", "suite", "--agent", "oracle"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('Harbor ran 1 job, "default", with the agent "oracle" and no model', async () => {
    const calls = await harborCalls(sut);
    expect(calls).toHaveLength(1);
    const call = calls[0] as string[];
    expect(flag(call, "--job-name")).toBe("default");
    expect(flag(call, "--agent")).toBe("oracle");
    expect(call).not.toContain("--model");
  });

  await then('"report.json" has the cell "default" and "oracle" with correctness 1', async () => {
    const report = await readJson(sut, "$OUTPUT/report.json");
    expect(report.cells).toHaveLength(1);
    expect(report.cells[0]).toMatchObject({ configuration: "default", model: "oracle", correctness: 1 });
  });
});
