import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-004", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let spec: Record<string, unknown> = {};
    await given('a sandbox spec with the test template and the variable "CI" set to "true"', async () => {
      // The spec's variables, not the adapter's environment.
      const variables = { CI: "true" };
      spec = { template: TEMPLATE, env: variables };
    });

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client creates a sandbox from the spec and runs "printenv CI" in it', async () => {
      const id = await box.create(spec);
      run = await sut.cli(["exec", id, "--", "printenv", "CI"]);
    });

    await then('the command prints "true"', async () => {
      expect(run.stdout, run.stderr).toBe("true\n");
    });
  } finally {
    await box.destroyAll();
  }
});
