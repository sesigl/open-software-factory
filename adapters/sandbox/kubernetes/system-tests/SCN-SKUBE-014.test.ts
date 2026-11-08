import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-014", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    let privileges: CliResult;
    let token: CliResult;
    await when(
      'the client runs "grep NoNewPrivs /proc/1/status" and "ls /var/run/secrets/kubernetes.io" in the sandbox',
      async () => {
        privileges = await box.cli(["exec", id, "--", "grep", "NoNewPrivs", "/proc/1/status"]);
        token = await box.cli(["exec", id, "--", "ls", "/var/run/secrets/kubernetes.io"]);
      },
    );

    await then('the first command prints "NoNewPrivs:" with the value 1', async () => {
      expect(privileges.exitCode, privileges.stderr).toBe(0);
      expect(privileges.stdout).toMatch(/^NoNewPrivs:\s+1\n$/);
    });

    await then("the second command fails, because the folder does not exist", async () => {
      expect(token.exitCode, token.stdout).not.toBe(0);
      expect(token.stderr).toContain("No such file or directory");
    });
  } finally {
    await box.destroyAll();
  }
});
