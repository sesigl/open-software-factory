import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-013", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    let run: CliResult;
    await when('the client runs "cat /etc/osf/egress-ca.crt" in the sandbox', async () => {
      run = await box.cli(["exec", id, "--", "cat", "/etc/osf/egress-ca.crt"]);
    });

    await then("the command exits with code 0 and prints one PEM certificate", async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(run.stdout).toMatch(/^-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\n]+-----END CERTIFICATE-----\n+$/);
    });
  } finally {
    await box.destroyAll();
  }
});
