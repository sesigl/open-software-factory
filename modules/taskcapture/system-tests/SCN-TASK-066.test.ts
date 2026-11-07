import { scenario } from "@opensoftware/testkit";
import { putJob, readJson, THREE_MODELS } from "./results.ts";

scenario("SCN-TASK-066", async ({ sut, given, when, then }) => {
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

  const chart = () => readJson(sut, "$INPUT/chart.json");

  await then('"chart.json" has the title "Correctness against average cost per trial"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect((await chart()).title).toBe("Correctness against average cost per trial");
  });

  await then(
    '"chart.json" titles the x axis "Average cost per trial (USD)" and the y axis "Correctness" in percent',
    async () => {
      const { x, y } = (await chart()).encoding;
      expect(x).toEqual({ field: "costUsdPerTrial", type: "quantitative", title: "Average cost per trial (USD)" });
      expect(y).toEqual({ field: "correctness", type: "quantitative", title: "Correctness", axis: { format: "%" } });
    },
  );

  await then('"chart.json" colors each point by its model and shapes it by its configuration', async () => {
    const { color, shape } = (await chart()).encoding;
    expect(color).toEqual({ field: "model", type: "nominal" });
    expect(shape).toEqual({ field: "configuration", type: "nominal" });
  });

  await then('"chart.json" marks each cell with a filled point of size 120 with a tooltip', async () => {
    const result = await chart();
    expect(result.mark).toEqual({ type: "point", filled: true, size: 120, tooltip: true });
    expect(result.data.values).toContainEqual({
      cell: "v1 · llama-9-tiny",
      configuration: "v1",
      model: "llama-9-tiny",
      correctness: 0.2,
      costUsdPerTrial: 1.5,
      paretoFront: true,
    });
  });
});
