import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-016", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the adapter\'s variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"', async () => {
    env = { OSF_SECRET_LINEAR_TOKEN: "lin_env_51c2" };
  });
  const box = sandboxes(sut, env);
  try {
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an API at "host.docker.internal" that answers "GET /viewer"', async () => {
      api = await fakes.http([{ path: "/viewer", body: { name: "Ada" } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"',
      async () => {
        id = await box.create({
          template: TEMPLATE,
          egress: ["host.docker.internal"],
          secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" },
        });
      },
    );

    await when(
      'the client runs "curl -H \'Authorization: Bearer $LINEAR_TOKEN\'" for "/viewer" of the API in the sandbox',
      async () => {
        await box.sh(id, `curl -sS -H "Authorization: Bearer $LINEAR_TOKEN" ${api?.containerUrl}/viewer`);
      },
    );

    await then('the API received "GET /viewer" with the header "Authorization: Bearer lin_env_51c2"', async () => {
      expect(api?.headers()).toMatchObject([
        { method: "GET", path: "/viewer", headers: { authorization: "Bearer lin_env_51c2" } },
      ]);
    });
  } finally {
    await box.destroyAll();
  }
});
