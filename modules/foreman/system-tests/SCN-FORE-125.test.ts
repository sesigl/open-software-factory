import { scenario } from "@opensoftware/testkit";
import { readmeWork, servingGateway } from "./foreman.ts";
import { revokes } from "./revoked.ts";

scenario("SCN-FORE-125", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm", and its run of the README\'s "work.json" completed',
    async () => {
      server = await servingGateway(sut, fakes);
      const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(runId, "complete");
      expect(await revokes(server.inference)).toHaveLength(1);
    },
  );

  await when("the server gets the signal SIGTERM", async () => {
    await sut.http.stop();
  });

  await then("the inference adapter's list is empty", async () => {
    expect(server.inference?.list()).toEqual([]);
  });
});
