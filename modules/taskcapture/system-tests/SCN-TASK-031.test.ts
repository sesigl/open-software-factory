import { scenario } from "@opensoftware/testkit";
import { deployments, putReport, THREE_MODELS } from "./routes.ts";

scenario("SCN-TASK-031", async ({ sut, given, when, then }) => {
  await given(
    'a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD',
    async () => {
      await putReport(sut, THREE_MODELS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture route --tag front-end --alias coder --min-correctness 0.95 report.json"',
    async () => {
      run = await sut.cli([
        "route",
        "--tag",
        "front-end",
        "--alias",
        "coder",
        "--min-correctness",
        "0.95",
        "report.json",
      ]);
    },
  );

  await then(
    '"litellm-config.yaml" has the deployment "coder" with the model "gpt-5.6-sol" and the tags "front-end"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(await deployments(sut)).toContainEqual({
        model_name: "coder",
        litellm_params: { model: "gpt-5.6-sol", tags: ["front-end"] },
      });
    },
  );

  await then('the output says "front-end → gpt-5.6-sol (correctness 100.0%, 6.23 USD per trial)"', async () => {
    expect(run.stdout).toContain("front-end → gpt-5.6-sol (correctness 100.0%, 6.23 USD per trial)");
  });
});
