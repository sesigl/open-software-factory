import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-017", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the adapter\'s variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"', async () => {
    env = { OSF_SECRET_LINEAR_TOKEN: "lin_env_51c2" };
  });
  const box = sandboxes(sut, env);
  try {
    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"',
      async () => {
        id = await box.create({ template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" } });
      },
    );

    let run: Awaited<ReturnType<typeof box.sh>>;
    await when('the client runs "env" in the sandbox', async () => {
      run = await box.sh(id, "env");
    });

    await then('the output has the variable "LINEAR_TOKEN"', async () => {
      expect(run.stdout, run.stderr).toMatch(/^LINEAR_TOKEN=.+$/m);
    });

    await then('the output does not contain "lin_env_51c2"', async () => {
      expect(run.stdout).not.toContain("lin_env_51c2");
    });
  } finally {
    await box.destroyAll();
  }
});
