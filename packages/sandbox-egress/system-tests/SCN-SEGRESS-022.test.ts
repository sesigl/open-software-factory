import { basicPlaceholder, proxyConfig, resolveSecrets, startScript } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { secretsDir, transform } from "./egress.ts";

scenario("SCN-SEGRESS-022", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  let dir = "";
  await given(
    'a sandbox spec with the egress allowlist "api.linear.app" and the secret "LINEAR_TOKEN" from "ref:file/linear-token"',
    async () => {
      spec = { template: "alpine", egress: ["api.linear.app"], secrets: { LINEAR_TOKEN: "ref:file/linear-token" } };
      dir = await secretsDir(sut, { "linear-token": "lin_real_7f3a" });
    },
  );

  let config: unknown;
  let secrets: ReturnType<typeof resolveSecrets> = [];
  await when("the adapter calls proxyConfig with the spec and its resolved secrets", async () => {
    secrets = resolveSecrets(spec, dir, {});
    config = proxyConfig(spec, secrets);
  });

  const swaps = () => (transform(config, "secrets") as { secrets: unknown[] }).secrets;

  await then(
    'the configuration swaps "osf-secret-placeholder-LINEAR_TOKEN" for the file "/osf/secrets/LINEAR_TOKEN" on requests to "api.linear.app"',
    async () => {
      expect(swaps()[0]).toEqual({
        source: { type: "file", path: "/osf/secrets/LINEAR_TOKEN" },
        proxy_value: "osf-secret-placeholder-LINEAR_TOKEN",
        match_headers: [],
        rules: [{ host: "api.linear.app" }],
      });
    },
  );

  await then(
    'it swaps the placeholder in git\'s Basic form, base64 of "x-access-token:osf-secret-placeholder-LINEAR_TOKEN", for the file "/osf/basic/LINEAR_TOKEN" in the header "Authorization" on requests to "api.linear.app"',
    async () => {
      const basic = Buffer.from("x-access-token:osf-secret-placeholder-LINEAR_TOKEN").toString("base64");
      expect(basicPlaceholder("LINEAR_TOKEN")).toBe(basic);
      expect(swaps()).toEqual([
        swaps()[0],
        {
          source: { type: "file", path: "/osf/basic/LINEAR_TOKEN" },
          proxy_value: basic,
          match_headers: ["Authorization"],
          rules: [{ host: "api.linear.app" }],
        },
      ]);
    },
  );

  await then(
    'the start script writes "/osf/basic/LINEAR_TOKEN" as base64 of "x-access-token:" and the secret\'s file',
    async () => {
      expect(startScript(secrets)).toContain(
        "printf '%s:%s' x-access-token \"$(cat /osf/secrets/LINEAR_TOKEN)\" | base64 | tr -d '\\n' > /osf/basic/LINEAR_TOKEN\n",
      );
    },
  );
});
