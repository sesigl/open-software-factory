import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-041", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes, { sandbox: {} });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.until(runId, "complete")).state).toBe("complete");
  });

  await then("the sandbox adapter created no sandbox", async () => {
    expect(server.sandbox?.created()).toEqual([]);
  });
});
