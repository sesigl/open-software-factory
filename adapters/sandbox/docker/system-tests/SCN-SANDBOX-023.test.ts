import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-023", async ({ sut, fakes, given, when, then }) => {
  const box = sandboxes(sut, { OSF_SECRETS_DIR: sut.files.path("$INPUT/secrets") });
  try {
    await given('the secret file "forge-token" with the value "ghp_real_51c2"', async () => {
      await sut.files.put("$INPUT/secrets/forge-token", "ghp_real_51c2");
    });

    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal" that answers "GET /info/refs"', async () => {
      api = await fakes.http([{ path: "/info/refs", body: { refs: [] } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "GH_TOKEN" from "ref:file/forge-token"',
      async () => {
        id = await box.create({
          template: TEMPLATE,
          egress: ["host.docker.internal"],
          secrets: { GH_TOKEN: "ref:file/forge-token" },
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
      'the API received "GET /info/refs" with the header "Authorization: Basic " and base64 of "x-access-token:ghp_real_51c2"',
      async () => {
        const basic = Buffer.from("x-access-token:ghp_real_51c2").toString("base64");
        expect(api?.headers()).toMatchObject([
          { method: "GET", path: "/info/refs", headers: { authorization: `Basic ${basic}` } },
        ]);
      },
    );
  } finally {
    await box.destroyAll();
  }
});
