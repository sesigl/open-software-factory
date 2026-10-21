import { scenario } from "@opensoftware/testkit";
import { putJob, THREE_MODELS } from "./results.ts";

scenario("SCN-TASK-027", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD',
    async () => {
      await putJob(sut, "v1", THREE_MODELS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report --markdown report.md v1"', async () => {
    run = await sut.cli(["report", "--markdown", "report.md", "v1"]);
  });

  await then('"report.md" has the table row "| v1 | glm-5.3-flash | 90.0% | 1.99 | 1 of 1 |"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect((await sut.files.read("$INPUT/report.md")).split("\n")).toContain(
      "| v1 | glm-5.3-flash | 90.0% | 1.99 | 1 of 1 |",
    );
  });

  await then('"report.md" says "Most efficient: v1 · glm-5.3-flash"', async () => {
    expect(await sut.files.read("$INPUT/report.md")).toContain("Most efficient: v1 · glm-5.3-flash");
  });
});
