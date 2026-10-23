import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-006", async ({ sut, fakes, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal"', async () => {
      api = await fakes.http([{ path: "/health", body: { ok: true } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"',
      async () => {
        id = await box.create({ template: TEMPLATE, egress: ["host.docker.internal"] });
      },
    );

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when("the client runs \"curl --noproxy '*'\" for the API in the sandbox", async () => {
      run = await box.sh(id, `curl -sS --max-time 5 --noproxy '*' ${api?.containerUrl}/health`);
    });

    await then("curl fails", async () => {
      expect(run.exitCode, run.stdout).not.toBe(0);
    });

    await then("the API received no request", async () => {
      expect(api?.requests()).toEqual([]);
    });
  } finally {
    await box.destroyAll();
  }
});
