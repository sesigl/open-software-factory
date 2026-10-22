import { scenario } from "@opensoftware/testkit";
import { flag, flags, harborCalls, putSuiteAndHarbor, runWithHarbor } from "./harbor.ts";
import { readJson } from "./results.ts";

scenario("SCN-TASK-042", async ({ sut, given, when, then }) => {
  await given('a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial', async () => {
    await putSuiteAndHarbor(sut, ["web-1", "web-2"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture run --suite suite --agent claude-code --model model-a --model model-b --configuration v1 --configuration v2"',
    async () => {
      run = await runWithHarbor(sut, [
        "run",
        "--suite",
        "suite",
        "--agent",
        "claude-code",
        "--model",
        "model-a",
        "--model",
        "model-b",
        "--configuration",
        "v1",
        "--configuration",
        "v2",
      ]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'Harbor ran 2 jobs, "v1" and "v2", each with the agent "claude-code" and the models "model-a" and "model-b"',
    async () => {
      const calls = await harborCalls(sut);
      expect(calls.map((call) => [call[0], flag(call, "--job-name")])).toEqual([
        ["run", "v1"],
        ["run", "v2"],
      ]);
      for (const call of calls) {
        expect(flag(call, "--path")).toBe("suite");
        expect(flag(call, "--agent")).toBe("claude-code");
        expect(flags(call, "--model")).toEqual(["model-a", "model-b"]);
        expect(call).toContain("--yes");
      }
    },
  );

  await then('"report.json" has 4 cells, one for each configuration and model', async () => {
    const report = await readJson(sut, "$OUTPUT/report.json");
    expect(
      report.cells.map((c: { configuration: string; model: string }) => `${c.configuration}/${c.model}`).sort(),
    ).toEqual(["v1/model-a", "v1/model-b", "v2/model-a", "v2/model-b"]);
  });
});
