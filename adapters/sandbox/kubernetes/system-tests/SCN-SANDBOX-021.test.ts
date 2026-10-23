import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-021", async ({ sut, given, when, then }) => {
  let spec: Record<string, unknown> = {};
  let env: Record<string, string> = {};
  await given(
    'a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"',
    async () => {
      spec = { template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } };
    },
  );

  await given('the adapter has no variable "OSF_OPENBAO_ADDR"', async () => {
    // The test passes the adapter only the variables it names; this one is not among them.
    env = { OSF_OPENBAO_TOKEN: "osf-test-bao-token" };
  });

  let run: Awaited<ReturnType<ReturnType<typeof sandboxes>["run"]>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sandboxes(sut, env).run(spec);
  });

  await then(
    'create exits with code 2 and says that the secret "LINEAR_TOKEN" needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain('secret "LINEAR_TOKEN": needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"');
    },
  );
});
