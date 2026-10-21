import { scenario } from "@opensoftware/testkit";
import { putReport, THREE_MODELS } from "./routes.ts";

scenario("SCN-TASK-035", async ({ sut, given, when, then }) => {
  await given(
    'a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD',
    async () => {
      await putReport(sut, THREE_MODELS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture route report.json"', async () => {
    run = await sut.cli(["route", "report.json"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: route takes --tag and --alias, like --tag front-end --alias coder"',
    async () => {
      expect(run.stderr).toBe("taskcapture: route takes --tag and --alias, like --tag front-end --alias coder\n");
    },
  );
});
