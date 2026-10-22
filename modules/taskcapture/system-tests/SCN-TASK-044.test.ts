import { scenario } from "@opensoftware/testkit";
import { flag, harborCalls, putSuiteAndHarbor, runWithHarbor } from "./harbor.ts";

scenario("SCN-TASK-044", async ({ sut, given, when, then }) => {
  await given('a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial', async () => {
    await putSuiteAndHarbor(sut, ["web-1", "web-2"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture run --suite suite --agent claude-code --model model-a --configuration v1 --configuration v2=harbor-v2.yaml"',
    async () => {
      run = await runWithHarbor(sut, [
        "run",
        "--suite",
        "suite",
        "--agent",
        "claude-code",
        "--model",
        "model-a",
        "--configuration",
        "v1",
        "--configuration",
        "v2=harbor-v2.yaml",
      ]);
    },
  );

  const job = async (name: string) => {
    expect(run.exitCode, run.stderr).toBe(0);
    return (await harborCalls(sut)).find((call) => flag(call, "--job-name") === name) as string[];
  };

  await then('Harbor ran the job "v2" with "--config harbor-v2.yaml"', async () => {
    expect(flag(await job("v2"), "--config")).toBe("harbor-v2.yaml");
  });

  await then('Harbor ran the job "v1" without "--config"', async () => {
    expect(await job("v1")).not.toContain("--config");
  });
});
