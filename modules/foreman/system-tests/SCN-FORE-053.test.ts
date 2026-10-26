import { scenario } from "@opensoftware/testkit";
import { endingTurns, otherWork, readmeWork, servingGateway } from "./foreman.ts";

scenario("SCN-FORE-053", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm"',
    async () => {
      server = await servingGateway(sut, fakes, { turns: [...endingTurns, ...endingTurns] });
    },
  );

  const runIds: string[] = [];
  await when('a program posts two work items to "/v1/runs" and both runs complete', async () => {
    for (const work of [readmeWork(fakes), otherWork(fakes)]) {
      const runId = (await server.start(work)).data?.runId as string;
      runIds.push(runId);
      await server.until(runId, "complete");
    }
  });

  await then('the inference adapter made one key for each run, with the run\'s ID and the budget "5"', async () => {
    expect(server.inference?.keys()).toEqual([
      { key: "sk-fake-1", gateway: "000000000001", run: runIds[0], budget: "5" },
      { key: "sk-fake-2", gateway: "000000000001", run: runIds[1], budget: "5" },
    ]);
  });

  await then("both stages of a run got the same key, and the two runs got different keys", async () => {
    expect(server.harness.sessions().map(({ env }) => env.OPENAI_API_KEY)).toEqual([
      "sk-fake-1",
      "sk-fake-1",
      "sk-fake-2",
      "sk-fake-2",
    ]);
  });
});
