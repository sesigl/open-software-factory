import { scenario } from "@opensoftware/testkit";
import { flag, flags, harborCalls, putSuiteAndHarbor, runWithHarbor } from "./harbor.ts";

scenario("SCN-TASK-045", async ({ sut, given, when, then }) => {
  await given('a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial', async () => {
    await putSuiteAndHarbor(sut, ["web-1", "web-2"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture run --suite suite --agent claude-code --model model-a --allow-host llm.example.com"',
    async () => {
      run = await runWithHarbor(sut, [
        "run",
        "--suite",
        "suite",
        "--agent",
        "claude-code",
        "--model",
        "model-a",
        "--allow-host",
        "llm.example.com",
      ]);
    },
  );

  await then('Harbor ran the job "default" with "--allow-agent-host llm.example.com"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    const [call, ...others] = await harborCalls(sut);
    expect(others).toEqual([]);
    expect(flag(call as string[], "--job-name")).toBe("default");
    expect(flags(call as string[], "--allow-agent-host")).toEqual(["llm.example.com"]);
  });
});
