import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-022", async ({ sut, given, when, then }) => {
  let spec: Record<string, unknown> = {};
  const env: Record<string, string> = {};
  await given(
    'a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:vault/linear-token"',
    async () => {
      spec = { template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:vault/linear-token" } };
    },
  );

  let run: Awaited<ReturnType<ReturnType<typeof sandboxes>["run"]>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sandboxes(sut, env).run(spec);
  });

  await then('create exits with code 2 and says that the provider "vault" is not supported', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain('secret "LINEAR_TOKEN": the provider "vault" is not supported');
  });
});
