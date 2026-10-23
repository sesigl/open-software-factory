import { scenario } from "@opensoftware/testkit";
import { OUTSIDE, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-005", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"',
      async () => {
        id = await box.create({ template: TEMPLATE, egress: ["host.docker.internal"] });
      },
    );

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client runs "curl http://api.example.invalid/" in the sandbox', async () => {
      run = await box.sh(id, `curl -s -o /dev/null -w '%{http_code}' http://${OUTSIDE}/`);
    });

    await then("the request gets the status 403", async () => {
      expect(run.stdout, run.stderr).toBe("403");
    });

    await then('the egress log holds a request to "api.example.invalid" refused by "allowlist"', async () => {
      expect(await box.egressLog(id)).toContainEqual(
        expect.objectContaining({ host: OUTSIDE, outcome: "refused", refusedBy: "allowlist" }),
      );
    });
  } finally {
    await box.destroyAll();
  }
});
