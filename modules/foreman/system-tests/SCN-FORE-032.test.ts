import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-032", async ({ sut, fakes, given, when, then }) => {
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

  const sandbox = () => server.sandbox as NonNullable<typeof server.sandbox>;
  await then(
    'the sandbox adapter got a spec with the template "node:24", the CPU 2, the memory "4Gi" and the egress hosts "registry.npmjs.org" and "api.anthropic.com"',
    async () => {
      const specs = sandbox().created();
      expect(specs).toHaveLength(2);
      for (const { spec } of specs)
        expect(spec).toMatchObject({
          template: "node:24",
          cpu: 2,
          memory: "4Gi",
          egress: ["registry.npmjs.org", "api.anthropic.com"],
        });
    },
  );

  await then("the harness adapter ran in the sandbox of each stage", async () => {
    const harness = sandbox()
      .execs()
      .filter(({ command }) => command.join(" ").includes(sut.adapter("harness/acp")));
    expect(harness.map(({ id }) => id)).toEqual(["000000000001", "000000000002"]);
    expect(server.prompts("Write a plan")).toHaveLength(1);
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.view(runId)).state).toBe("complete");
  });
});
