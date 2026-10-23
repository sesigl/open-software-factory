import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

/** OpenBao's answer to a read of a KV v2 secret. */
const KV_ANSWER = {
  data: { data: { value: "bao_real_93d1" }, metadata: { version: 1, created_time: "2026-01-01T00:00:00Z" } },
};

scenario("SCN-SANDBOX-019", async ({ sut, fakes, given, when, then }) => {
  let bao: Awaited<ReturnType<typeof fakes.http>> | undefined;
  await given(
    'OpenBao at "host.docker.internal" that holds "linear-token" with the value "bao_real_93d1" for the token "osf-test-bao-token"',
    async () => {
      bao = await fakes.http([{ path: "/v1/secret/data/linear-token", body: KV_ANSWER }], { containers: true });
    },
  );
  const box = sandboxes(sut, {
    OSF_OPENBAO_ADDR: bao?.containerUrl ?? "",
    OSF_OPENBAO_TOKEN: "osf-test-bao-token",
  });
  try {
    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"',
      async () => {
        id = await box.create({ template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } });
      },
    );

    let run: Awaited<ReturnType<typeof box.sh>>;
    await when('the client runs "env" in the sandbox', async () => {
      run = await box.sh(id, "env");
    });

    await then('the output does not contain "osf-test-bao-token"', async () => {
      expect(run.stdout, run.stderr).toMatch(/^LINEAR_TOKEN=.+$/m);
      expect(run.stdout).not.toContain("osf-test-bao-token");
    });

    await then('the output does not contain "bao_real_93d1"', async () => {
      expect(run.stdout).not.toContain("bao_real_93d1");
    });
  } finally {
    await box.destroyAll();
  }
});
