import { scenario } from "@opensoftware/testkit";
import { readmeWork, servingGateway } from "./foreman.ts";

scenario("SCN-FORE-124", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm" whose revoke fails with "LiteLLM is down"',
    async () => {
      server = await servingGateway(sut, fakes, { inference: { revokeFails: "LiteLLM is down" } });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.until(runId, "complete")).state).toBe("complete");
  });

  await then('the server warned that it could not revoke the run\'s key, with "LiteLLM is down"', async () => {
    const deadline = Date.now() + 10_000;
    const warnings = () =>
      sut.http
        .output()
        .stderr.split("\n")
        .filter((line) => line.includes("revoke"));
    while (warnings().length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(warnings()).toEqual([
      `foreman: the key of the run ${runId}: the inference adapter's revoke failed: LiteLLM is down`,
    ]);
  });
});
