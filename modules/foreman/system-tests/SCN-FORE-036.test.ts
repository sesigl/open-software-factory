import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-036", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes, { factory: sandboxedFactory(fakes), sandbox: {} });
    },
  );

  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token and the run completes',
    async () => {
      const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(runId, "complete");
    },
  );

  await then("the sandbox adapter created 2 sandboxes", async () => {
    expect(server.sandbox?.created().map(({ id }) => id)).toEqual(["000000000001", "000000000002"]);
  });

  await then("its sandbox list is empty", async () => {
    expect(server.sandbox?.list()).toEqual([]);
  });
});
