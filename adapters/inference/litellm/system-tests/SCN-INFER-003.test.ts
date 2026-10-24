import { scenario } from "@opensoftware/testkit";
import { call, gateways, models, provider } from "./gateway.ts";

scenario("SCN-INFER-003", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 1);
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config like "taskcapture route" writes, which sends "coder" with the tag "front-end" to "glm-5.3-flash"',
      async () => {
        // The deployment taskcapture route adds next to the config's other deployment of "coder", and its setting.
        const base = `${api.containerUrl}/v1`;
        const text = [
          "model_list:",
          "  - model_name: coder",
          "    litellm_params:",
          "      model: openai/claude-sonnet-5-5",
          `      api_base: ${base}`,
          "      api_key: unused",
          "      tags: [default]",
          "  - model_name: coder",
          "    litellm_params:",
          "      model: openai/glm-5.3-flash",
          `      api_base: ${base}`,
          "      api_key: unused",
          "      tags: [front-end]",
          "router_settings:",
          "  enable_tag_filtering: true",
          "",
        ].join("\n");
        gateway = await box.start(text);
      },
    );

    await when('a run calls "coder" with the tag "front-end"', async () => {
      const key = await box.key(gateway.id, "run-1");
      const answer = await call(gateway.url, key, { model: "coder", tags: ["front-end"] });
      expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    });

    await then('the test provider received a call for the model "glm-5.3-flash"', async () => {
      expect(models(api)).toEqual(["glm-5.3-flash"]);
    });
  } finally {
    await box.stopAll();
  }
});
