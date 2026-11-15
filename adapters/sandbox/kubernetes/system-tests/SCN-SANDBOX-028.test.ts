import { scenario } from "@opensoftware/testkit";
import { readToken, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-028", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'OpenBao for containers that holds "forge-token" with the value "bao_forge_7c41", and its read token',
    async () => {
      const bao = await fakes.openbao({ containers: true });
      await bao.write("forge-token", { value: "bao_forge_7c41" });
      env = await readToken(bao);
    },
  );
  const box = sandboxes(sut, env);
  try {
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal" that answers "GET /info/refs"', async () => {
      api = await fakes.http([{ path: "/info/refs", body: { refs: [] } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "GH_TOKEN" from "ref:openbao/forge-token"',
      async () => {
        id = await box.create({
          template: TEMPLATE,
          egress: ["host.docker.internal"],
          secrets: { GH_TOKEN: "ref:openbao/forge-token" },
        });
      },
    );

    await when(
      'the client runs "curl -u x-access-token:$GH_TOKEN", as git sends a token, for "/info/refs" of the API in the sandbox',
      async () => {
        await box.sh(id, `curl -sS -u "x-access-token:$GH_TOKEN" ${api?.containerUrl}/info/refs`);
      },
    );

    await then(
      'the API received "GET /info/refs" with the header "Authorization: Basic " and base64 of "x-access-token:bao_forge_7c41"',
      async () => {
        const basic = Buffer.from("x-access-token:bao_forge_7c41").toString("base64");
        expect(api?.headers()).toMatchObject([
          { method: "GET", path: "/info/refs", headers: { authorization: `Basic ${basic}` } },
        ]);
      },
    );
  } finally {
    await box.destroyAll();
  }
});
