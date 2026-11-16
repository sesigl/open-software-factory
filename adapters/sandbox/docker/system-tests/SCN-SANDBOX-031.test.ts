import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-031", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  let first = "";
  let second = "";
  try {
    await given(
      'a sandbox created from a spec with the test template and the label "osf.run" set to "run-1"',
      async () => {
        first = await box.create({ template: TEMPLATE, labels: { "osf.run": "run-1" } });
      },
    );

    await given(
      'a second sandbox created from a spec with the test template and the label "osf.run" set to "run-2"',
      async () => {
        second = await box.create({ template: TEMPLATE, labels: { "osf.run": "run-2" } });
      },
    );

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client runs "list --label osf.run=run-1"', async () => {
      run = await sut.cli(["list", "--label", "osf.run=run-1"]);
    });

    await then("the output holds the first sandbox and not the second", async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const ids = run.stdout.split("\n");
      expect(ids).toContain(first);
      expect(ids).not.toContain(second);
    });
  } finally {
    await box.destroyAll();
  }
});
