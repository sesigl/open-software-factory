import { scenario } from "@opensoftware/testkit";
import { failed, gatewayFactory, newRunOf, refusedOnce } from "./foreman.ts";

scenario("SCN-FORE-106", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm", and its run of the README\'s "work.json" failed in the stage "implement"',
    async () => {
      run = await failed(sut, fakes, { factory: gatewayFactory(fakes), inference: {}, turns: refusedOnce });
    },
  );

  let newId = "";
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    newId = newRunOf(await run.retry(run.runId));
    await run.until(newId, "complete");
  });

  await then('the inference adapter made a second key, with the new run\'s ID and the budget "5"', async () => {
    expect(run.inference?.keys()).toEqual([
      { key: "sk-fake-1", gateway: "000000000001", run: run.runId, budget: "5" },
      { key: "sk-fake-2", gateway: "000000000001", run: newId, budget: "5" },
    ]);
    expect(run.harness.sessions().map(({ env }) => env.OPENAI_API_KEY)).toEqual([
      "sk-fake-1",
      "sk-fake-1",
      "sk-fake-2",
    ]);
  });
});
