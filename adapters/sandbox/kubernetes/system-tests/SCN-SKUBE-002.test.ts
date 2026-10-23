import { scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

scenario("SCN-SKUBE-002", async ({ sut, given, when, then }) => {
  let spec: Record<string, unknown> = {};
  await given('a sandbox spec with the template "small" and no SandboxTemplate "small" in the namespace', async () => {
    spec = { template: "small" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sandboxes(sut).run(spec);
  });

  await then('create exits with code 1 and says that the namespace has no SandboxTemplate "small"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toContain('the namespace "default" has no SandboxTemplate "small"');
  });
});
