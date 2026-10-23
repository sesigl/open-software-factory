import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-020", async ({ sut, given, when, then }) => {
  let spec: Record<string, unknown> = {};
  let env: Record<string, string> = {};
  await given(
    'a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"',
    async () => {
      spec = { template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" } };
    },
  );

  await given('the adapter has no variable "OSF_SECRET_LINEAR_TOKEN"', async () => {
    // The test passes the adapter only the variables it names; this one is not among them.
    env = { OSF_SECRET_GITHUB_TOKEN: "gh_env_0a1b" };
  });

  let run: Awaited<ReturnType<ReturnType<typeof sandboxes>["run"]>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sandboxes(sut, env).run(spec);
  });

  await then(
    'create exits with code 2 and says that the secret "LINEAR_TOKEN" needs the variable "OSF_SECRET_LINEAR_TOKEN"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain('secret "LINEAR_TOKEN": needs the variable "OSF_SECRET_LINEAR_TOKEN"');
    },
  );
});
