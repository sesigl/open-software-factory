import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-085", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" without "providers.sandbox" and a fake sandbox adapter as "docker"',
    async () => {
      const factory = sandboxedFactory(fakes).replace(/\n {2}sandbox:\n {4}docker: "\^0"/, "");
      expect(factory).not.toContain("docker:");
      server = await serving(sut, fakes, { factory, sandbox: {} });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then('the fake sandbox adapter "docker" created the sandbox of each stage', async () => {
    expect((server.sandbox as NonNullable<typeof server.sandbox>).created()).toHaveLength(2);
  });
});
