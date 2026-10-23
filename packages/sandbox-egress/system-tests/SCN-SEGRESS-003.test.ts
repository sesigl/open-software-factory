import { proxyConfig, resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { type Config, secretsDir } from "./egress.ts";

scenario("SCN-SEGRESS-003", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  let dir = "";
  await given(
    'a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/linear-token" and no egress allowlist',
    async () => {
      spec = { template: "alpine", secrets: { LINEAR_TOKEN: "ref:file/linear-token" } };
      dir = await secretsDir(sut, { "linear-token": "lin_real_7f3a" });
    },
  );

  let config: unknown;
  await when("the adapter calls proxyConfig with the spec and its resolved secrets", async () => {
    config = proxyConfig(spec, resolveSecrets(spec, dir, {}));
  });

  await then("the configuration has no secrets transform", async () => {
    expect((config as Config).transforms.map((entry) => entry.name)).toEqual(["allowlist"]);
  });
});
