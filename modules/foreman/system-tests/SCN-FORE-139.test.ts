import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-139", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" without "providers.sandbox", with no adapter maps and an "npx" that runs the fake adapters',
    async () => {
      const factory = sandboxedFactory(fakes).replace('  sandbox:\n    docker: "^0"\n', "");
      expect(factory).not.toContain('docker: "^0"');
      server = await serving(sut, fakes, { factory, sandbox: {}, npx: true });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    'the run completes, and "npx" ran "@opensoftware/sandbox-docker" with no range, the adapter of "FOREMAN_SANDBOX"',
    async () => {
      const view = await server.until(runId, "complete");
      expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "succeeded"]);
      const calls = (await sut.files.read("$OUTPUT/npx.log")).split("\n");
      expect(calls).toContainEqual(expect.stringMatching(/^-y @opensoftware\/sandbox-docker /));
    },
  );
});
