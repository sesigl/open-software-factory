import type { OpenBao } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { readToken, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-029", async ({ sut, fakes, given, when, then }) => {
  let bao: OpenBao | undefined;
  let env: Record<string, string> = {};
  await given(
    'OpenBao for containers that holds "forge-token" with the value "bao_old_1d2e", and its read token',
    async () => {
      bao = await fakes.openbao({ containers: true });
      await bao.write("forge-token", { value: "bao_old_1d2e" });
      env = await readToken(bao);
    },
  );
  const box = sandboxes(sut, env);
  try {
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal" that answers "GET /viewer"', async () => {
      api = await fakes.http([{ path: "/viewer", body: { name: "Ada" } }], { containers: true });
    });

    const spec = {
      template: TEMPLATE,
      egress: ["host.docker.internal"],
      secrets: { GH_TOKEN: "ref:openbao/forge-token" },
    };
    const curl = () => `curl -sS -H "Authorization: Bearer $GH_TOKEN" ${api?.containerUrl}/viewer`;
    let first = "";
    await given(
      'a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "GH_TOKEN" from "ref:openbao/forge-token", which sent "curl -H \'Authorization: Bearer $GH_TOKEN\'" for "/viewer" of the API',
      async () => {
        first = await box.create(spec);
        await box.sh(first, curl());
      },
    );

    await given('another client then stored the value "bao_new_8f3a" for "forge-token" in OpenBao', async () => {
      await bao?.write("forge-token", { value: "bao_new_8f3a" });
    });

    await when(
      "the client runs the same curl in that sandbox and in a second sandbox created from the same spec",
      async () => {
        await box.sh(first, curl());
        await box.sh(await box.create(spec), curl());
      },
    );

    await then(
      'the API received "Authorization: Bearer bao_old_1d2e" twice, from the first sandbox, and then "Authorization: Bearer bao_new_8f3a" from the second',
      async () => {
        expect(api?.headers().map((request) => request.headers.authorization)).toEqual([
          "Bearer bao_old_1d2e",
          "Bearer bao_old_1d2e",
          "Bearer bao_new_8f3a",
        ]);
      },
    );
  } finally {
    await box.destroyAll();
  }
});
