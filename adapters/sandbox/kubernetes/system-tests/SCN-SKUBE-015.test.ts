import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-015", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given(
      'a sandbox created from a spec with the test template, in which "secret.txt" has the mode 000',
      async () => {
        id = await box.create({ template: TEMPLATE });
        const written = await box.sh(id, "printf hidden > secret.txt && chmod 000 secret.txt");
        expect(written.exitCode, written.stderr).toBe(0);
      },
    );

    let run: CliResult;
    await when("the client snapshots the sandbox", async () => {
      run = await box.cli(["snapshot", id]);
    });

    await then(
      'snapshot exits with code 1 and writes "kubectl exec failed: " and tar\'s error, which names "secret.txt"',
      async () => {
        expect(run.exitCode, run.stderr).toBe(1);
        expect(run.stderr).toMatch(/sandbox-kubernetes: kubectl exec failed: [^\n]*secret\.txt/);
      },
    );
  } finally {
    await box.destroyAll();
  }
});
