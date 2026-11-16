import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-187", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" with "FOREMAN_SANDBOX_OWNER" set to "factory-a", a fake sandbox adapter as "docker" and a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes, {
        factory: sandboxedFactory(fakes),
        sandbox: {},
        env: { FOREMAN_SANDBOX_OWNER: "factory-a" },
      });
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

  await then(
    'the spec of each stage\'s sandbox has the labels "osf.owner" "factory-a" and "osf.run" the run\'s ID',
    async () => {
      const specs = server.sandbox?.created() ?? [];
      expect(specs).toHaveLength(2);
      for (const { spec } of specs) expect(spec.labels).toEqual({ "osf.owner": "factory-a", "osf.run": runId });
    },
  );

  await then("the server's output names no sandbox that a foreman before left", async () => {
    expect(sut.http.output().stderr).not.toContain("that a foreman before left");
  });
});
