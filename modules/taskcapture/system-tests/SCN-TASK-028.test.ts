import { scenario } from "@opensoftware/testkit";
import { putJob, readJson, THREE_MODELS } from "./results.ts";

scenario("SCN-TASK-028", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD',
    async () => {
      await putJob(sut, "v1", THREE_MODELS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report --chart chart.json v1"', async () => {
    run = await sut.cli(["report", "--chart", "chart.json", "v1"]);
  });

  await then(
    '"chart.json" is a Vega-Lite point chart with the average cost per trial on x and the correctness on y',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const chart = await readJson(sut, "$INPUT/chart.json");
      expect(chart.$schema).toBe("https://vega.github.io/schema/vega-lite/v5.json");
      expect(chart.mark.type).toBe("point");
      expect(chart.encoding.x.field).toBe("costUsdPerTrial");
      expect(chart.encoding.y.field).toBe("correctness");
    },
  );

  await then('"chart.json" holds 3 points, one per cell', async () => {
    const chart = await readJson(sut, "$INPUT/chart.json");
    expect(chart.data.values).toHaveLength(3);
    expect(chart.data.values).toContainEqual(
      expect.objectContaining({ model: "glm-5.3-flash", correctness: 0.9, costUsdPerTrial: 1.99, paretoFront: true }),
    );
  });
});
