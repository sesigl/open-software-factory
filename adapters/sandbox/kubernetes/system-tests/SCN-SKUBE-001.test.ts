import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-001", async ({ sut, given, when, then }) => {
  let spec: Record<string, unknown> = {};
  await given('a sandbox spec with the CPU "four"', async () => {
    spec = { template: TEMPLATE, cpu: "four" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sandboxes(sut).run(spec);
  });

  await then('create exits with code 2 and names "/cpu" as invalid', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("sandbox-kubernetes: spec.json: /cpu must be number");
  });
});
