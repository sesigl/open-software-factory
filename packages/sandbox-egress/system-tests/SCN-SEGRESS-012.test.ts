import { resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { secretsDir } from "./egress.ts";

scenario("SCN-SEGRESS-012", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof resolveSecrets>[0];
  let dir = "";
  await given('a sandbox spec with the secret "LINEAR_TOKEN" from "ref:vault/linear-token"', async () => {
    spec = { template: "alpine", secrets: { LINEAR_TOKEN: "ref:vault/linear-token" } };
    dir = await secretsDir(sut);
  });

  let error: unknown;
  await when("the adapter calls resolveSecrets with the spec", async () => {
    try {
      resolveSecrets(spec, dir, {});
    } catch (thrown) {
      error = thrown;
    }
  });

  await then('it fails with a usage error that says the provider "vault" is not supported', async () => {
    expect((error as Error).constructor.name).toBe("UsageError");
    expect((error as Error).message).toBe(
      'secret "LINEAR_TOKEN": the provider "vault" is not supported; sandbox adapters support "file", "env" and "openbao"',
    );
  });
});
