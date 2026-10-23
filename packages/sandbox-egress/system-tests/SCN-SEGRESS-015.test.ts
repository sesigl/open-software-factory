import { resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { catching, secretsDir } from "./egress.ts";

scenario("SCN-SEGRESS-015", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof resolveSecrets>[0];
  let dir = "";
  await given(
    'a sandbox spec with the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN" and no variable "OSF_SECRET_LINEAR_TOKEN"',
    async () => {
      spec = { template: "alpine", secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" } };
      dir = await secretsDir(sut);
    },
  );

  let error: unknown;
  await when("the adapter calls resolveSecrets with the spec", async () => {
    error = catching(() => resolveSecrets(spec, dir, { OSF_SECRET_OTHER: "x" }));
  });

  await then(
    'it fails with a usage error that says the secret "LINEAR_TOKEN" needs the variable "OSF_SECRET_LINEAR_TOKEN"',
    async () => {
      expect((error as Error).constructor.name).toBe("UsageError");
      expect((error as Error).message).toBe('secret "LINEAR_TOKEN": needs the variable "OSF_SECRET_LINEAR_TOKEN"');
    },
  );
});
