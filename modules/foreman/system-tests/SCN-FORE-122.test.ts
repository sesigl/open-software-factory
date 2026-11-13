import { scenario } from "@opensoftware/testkit";
import { readmeWork, servingGateway } from "./foreman.ts";
import { revokes } from "./revoked.ts";

scenario("SCN-FORE-122", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm"',
    async () => {
      server = await servingGateway(sut, fakes);
    },
  );

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token and the run completes',
    async () => {
      runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(runId, "complete");
    },
  );

  await then('the inference adapter revoked the key of the run once, on the gateway "000000000001"', async () => {
    expect(await revokes(server.inference)).toEqual([{ gateway: "000000000001", run: runId }]);
  });
});
