import { scenario } from "@opensoftware/testkit";
import { deployments, putReport, readConfig, THREE_MODELS } from "./routes.ts";

scenario("SCN-TASK-034", async ({ sut, given, when, then }) => {
  await given(
    'a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD',
    async () => {
      await putReport(sut, THREE_MODELS);
    },
  );

  await given(
    'a LiteLLM config "proxy.yaml" with the deployment "coder" of "gpt-5.6-sol" tagged "default" and the deployment "coder" of "old-model" tagged "front-end"',
    async () => {
      await sut.files.put(
        "$INPUT/proxy.yaml",
        [
          "model_list:",
          "  - model_name: coder",
          "    litellm_params:",
          "      model: gpt-5.6-sol",
          "      tags: [default]",
          "  - model_name: coder",
          "    litellm_params:",
          "      model: old-model",
          "      tags: [front-end]",
          "general_settings:",
          "  master_key: os.environ/LITELLM_MASTER_KEY",
          "",
        ].join("\n"),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture route --tag front-end --alias coder --config proxy.yaml report.json"',
    async () => {
      run = await sut.cli(["route", "--tag", "front-end", "--alias", "coder", "--config", "proxy.yaml", "report.json"]);
    },
  );

  await then(
    '"litellm-config.yaml" has the deployment "coder" with the model "gpt-5.6-sol" and the tags "default"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(await deployments(sut)).toContainEqual({
        model_name: "coder",
        litellm_params: { model: "gpt-5.6-sol", tags: ["default"] },
      });
      expect(await readConfig(sut)).toContain("\ngeneral_settings:\n  master_key: os.environ/LITELLM_MASTER_KEY\n");
    },
  );

  await then(
    '"litellm-config.yaml" has the deployment "coder" with the model "glm-5.3-flash" and the tags "front-end"',
    async () => {
      expect(await deployments(sut)).toContainEqual({
        model_name: "coder",
        litellm_params: { model: "glm-5.3-flash", tags: ["front-end"] },
      });
    },
  );

  await then('"litellm-config.yaml" has no deployment with the model "old-model"', async () => {
    expect(JSON.stringify(await deployments(sut))).not.toContain("old-model");
    expect(await deployments(sut)).toHaveLength(2);
  });
});
