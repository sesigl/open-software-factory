import { proxyConfig, resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { secretsDir, transform } from "./egress.ts";

scenario("SCN-SEGRESS-002", async ({ sut, given, when, then }) => {
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
  await when("the adapter calls proxyConfig with the spec and its resolved secrets", async () => {
    config = proxyConfig(spec, resolveSecrets(spec, dir, {}));
  });

  await then(
    'the configuration swaps "osf-secret-placeholder-LINEAR_TOKEN" for the file "/osf/secrets/LINEAR_TOKEN" on requests to "api.linear.app"',
    async () => {
      expect(transform(config, "secrets")).toEqual({
        secrets: [
          {
            source: { type: "file", path: "/osf/secrets/LINEAR_TOKEN" },
            proxy_value: "osf-secret-placeholder-LINEAR_TOKEN",
            match_headers: [],
            rules: [{ host: "api.linear.app" }],
          },
        ],
      });
    },
  );
});
