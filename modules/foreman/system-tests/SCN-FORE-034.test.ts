import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-034", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes, { factory: sandboxedFactory(fakes), sandbox: {} });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the spec of the "plan" stage\'s sandbox sets "OTEL_RESOURCE_ATTRIBUTES" to name the run, the work item, the stage "plan" and the factory version',
    async () => {
      const [plan] = server.sandbox?.created() ?? [];
      expect(plan?.spec.env).toEqual({
        OTEL_RESOURCE_ATTRIBUTES: [
          `osf.run.id=${runId}`,
          `osf.work_item.id=${readmeWork(fakes).id}`,
          "osf.stage=plan",
          `osf.factory.version=${server.commit}`,
        ].join(","),
      });
    },
  );
});
