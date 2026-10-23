import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-007", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut, { OSF_SECRETS_DIR: sut.files.path("$INPUT/secrets") });
  try {
    await given('the secret file "linear-token" with the value "lin_real_7f3a"', async () => {
      await sut.files.put("$INPUT/secrets/linear-token", "lin_real_7f3a");
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:file/linear-token"',
      async () => {
        id = await box.create({ template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:file/linear-token" } });
      },
    );

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client runs "env" in the sandbox', async () => {
      run = await box.cli(["exec", id, "--", "env"]);
    });

    await then('the output has the variable "LINEAR_TOKEN"', async () => {
      expect(run.stdout, run.stderr).toMatch(/^LINEAR_TOKEN=.+$/m);
    });

    await then('the output does not contain "lin_real_7f3a"', async () => {
      expect(run.stdout).not.toContain("lin_real_7f3a");
    });
  } finally {
    await box.destroyAll();
  }
});
