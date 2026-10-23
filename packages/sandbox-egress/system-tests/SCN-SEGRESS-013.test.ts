import { resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { catching, secretsDir } from "./egress.ts";

scenario("SCN-SEGRESS-013", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof resolveSecrets>[0];
  let dir = "";
  await given('a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/../.ssh/id_ed25519"', async () => {
    spec = { template: "alpine", secrets: { LINEAR_TOKEN: "ref:file/../.ssh/id_ed25519" } };
    dir = await secretsDir(sut);
  });

  let error: unknown;
  await when("the adapter calls resolveSecrets with the spec", async () => {
    error = catching(() => resolveSecrets(spec, dir, {}));
  });

  await then('it fails with a usage error that says the name "../.ssh/id_ed25519" leaves OSF_SECRETS_DIR', async () => {
    expect((error as Error).constructor.name).toBe("UsageError");
    expect((error as Error).message).toBe(
      'secret "LINEAR_TOKEN": the name "../.ssh/id_ed25519" leaves OSF_SECRETS_DIR',
    );
  });
});
