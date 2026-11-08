import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

/** The address of host.docker.internal on the cluster's network, from the aliases the cluster's setup gives. */
const HOST_ADDRESS = /host\.docker\.internal=([^,\s]+)/.exec(process.env.OSF_SANDBOX_HOST_ALIASES ?? "")?.[1] ?? "";

scenario("SCN-SKUBE-017", async ({ sut, fakes, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    let address = "";
    await given('an API at "host.docker.internal" and its address on the cluster\'s network', async () => {
      api = await fakes.http([{ path: "/health", body: { ok: true } }], { containers: true });
      expect(HOST_ADDRESS, "OSF_SANDBOX_HOST_ALIASES names no address of host.docker.internal").not.toBe("");
      address = (api.containerUrl ?? "").replace("host.docker.internal", HOST_ADDRESS);
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"',
      async () => {
        id = await box.create({ template: TEMPLATE, egress: ["host.docker.internal"] });
      },
    );

    let run: CliResult;
    await when("the client runs \"curl --noproxy '*'\" for the API's address in the sandbox", async () => {
      run = await box.sh(id, `curl -sS --max-time 5 --noproxy '*' ${address}/health`);
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
