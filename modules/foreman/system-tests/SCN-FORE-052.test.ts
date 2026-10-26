import { scenario } from "@opensoftware/testkit";
import { endingTurns, otherWork, readmeFiles, readmeWork, servingGateway } from "./foreman.ts";

scenario("SCN-FORE-052", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm"',
    async () => {
      server = await servingGateway(sut, fakes, { turns: [...endingTurns, ...endingTurns] });
    },
  );

  await when('a program posts two work items to "/v1/runs" and both runs complete', async () => {
    for (const work of [readmeWork(fakes), otherWork(fakes)])
      await server.until((await server.start(work)).data?.runId as string, "complete");
  });

  await then('the inference adapter started one gateway from the text of "inference/litellm.yaml"', async () => {
    expect(server.inference?.started()).toEqual([
      { id: "000000000001", config: readmeFiles(fakes)["inference/litellm.yaml"] },
    ]);
  });

  await then('its list shows the gateway "000000000001"', async () => {
    expect(server.inference?.list()).toEqual(["000000000001"]);
  });
});
