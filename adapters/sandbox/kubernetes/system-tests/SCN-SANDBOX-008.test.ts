import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-008", async ({ sut, fakes, given, when, then }) => {
  const box = sandboxes(sut, { OSF_SECRETS_DIR: sut.files.path("$INPUT/secrets") });
  try {
    await given('the secret file "linear-token" with the value "lin_real_7f3a"', async () => {
      await sut.files.put("$INPUT/secrets/linear-token", "lin_real_7f3a");
    });

    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal" that answers "GET /viewer"', async () => {
      api = await fakes.http([{ path: "/viewer", body: { name: "Ada" } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:file/linear-token"',
      async () => {
        id = await box.create({
          template: TEMPLATE,
          egress: ["host.docker.internal"],
          secrets: { LINEAR_TOKEN: "ref:file/linear-token" },
        });
      },
    );

    await when(
      'the client runs "curl -H \'Authorization: Bearer $LINEAR_TOKEN\'" for "/viewer" of the API in the sandbox',
      async () => {
        await box.sh(id, `curl -sS -H "Authorization: Bearer $LINEAR_TOKEN" ${api?.containerUrl}/viewer`);
      },
    );

    await then('the API received "GET /viewer" with the header "Authorization: Bearer lin_real_7f3a"', async () => {
      expect(api?.headers()).toMatchObject([
        { method: "GET", path: "/viewer", headers: { authorization: "Bearer lin_real_7f3a" } },
      ]);
    });

    await then(
      'the egress log holds an allowed request to "/viewer" in which the proxy put the secret "LINEAR_TOKEN"',
      async () => {
        expect(await box.egressLog(id)).toContainEqual(
          expect.objectContaining({ path: "/viewer", outcome: "allowed", secrets: ["LINEAR_TOKEN"] }),
        );
      },
    );
  } finally {
    await box.destroyAll();
  }
});
