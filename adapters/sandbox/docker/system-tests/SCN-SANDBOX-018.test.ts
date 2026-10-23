import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

/** OpenBao's answer to a read of a KV v2 secret. */
const KV_ANSWER = {
  data: { data: { value: "bao_real_93d1" }, metadata: { version: 1, created_time: "2026-01-01T00:00:00Z" } },
};

scenario("SCN-SANDBOX-018", async ({ sut, fakes, given, when, then }) => {
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
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal" that answers "GET /viewer"', async () => {
      api = await fakes.http([{ path: "/viewer", body: { name: "Ada" } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"',
      async () => {
        id = await box.create({
          template: TEMPLATE,
          egress: ["host.docker.internal"],
          secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" },
        });
      },
    );

    await when(
      'the client runs "curl -H \'Authorization: Bearer $LINEAR_TOKEN\'" for "/viewer" of the API in the sandbox',
      async () => {
        await box.sh(id, `curl -sS -H "Authorization: Bearer $LINEAR_TOKEN" ${api?.containerUrl}/viewer`);
      },
    );

    await then('the API received "GET /viewer" with the header "Authorization: Bearer bao_real_93d1"', async () => {
      expect(api?.headers()).toMatchObject([
        { method: "GET", path: "/viewer", headers: { authorization: "Bearer bao_real_93d1" } },
      ]);
    });

    await then(
      'OpenBao received a read of "secret/data/linear-token" with the token "osf-test-bao-token"',
      async () => {
        expect(bao?.headers()).toMatchObject([
          { method: "GET", path: "/v1/secret/data/linear-token", headers: { "x-vault-token": "osf-test-bao-token" } },
        ]);
      },
    );
  } finally {
    await box.destroyAll();
  }
});
