import { scenario } from "@opensoftware/testkit";
import { failed, newRunOf } from "./foreman.ts";
import { receiver } from "./traces.ts";

scenario("SCN-FORE-107", async ({ sut, fakes, given, when, then }) => {
  let otlp: Awaited<ReturnType<typeof receiver>>;
  let run: Awaited<ReturnType<typeof failed>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with an OTLP receiver, and its run of the README\'s "work.json" failed in the stage "implement"',
    async () => {
      otlp = await receiver(fakes);
      run = await failed(sut, fakes, { env: { OTEL_EXPORTER_OTLP_ENDPOINT: otlp.url } });
    },
  );

  let newId = "";
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    newId = newRunOf(await run.retry(run.runId));
    await run.until(newId, "complete");
  });

  await then(
    'the receiver got the new run\'s span in a trace other than the first run\'s, with the attribute "osf.run.retry_of" "<id>"',
    async () => {
      await expect
        .poll(() => otlp.spans().filter(({ name }) => name === "run hello").length, { timeout: 10_000 })
        .toBe(2);
      const [first, second] = otlp.spans().filter(({ name }) => name === "run hello");
      expect(first?.resource["osf.run.id"]).toBe(run.runId);
      expect(first?.attributes["osf.run.retry_of"]).toBeUndefined();
      expect(second?.resource["osf.run.id"]).toBe(newId);
      expect(second?.traceId).not.toBe(first?.traceId);
      expect(second?.traceId).toBe((await run.view(newId)).traceId);
      expect(second?.attributes["osf.run.retry_of"]).toBe(run.runId);
    },
  );
});
