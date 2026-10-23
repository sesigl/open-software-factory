import { resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { secretsDir } from "./egress.ts";

scenario("SCN-SEGRESS-017", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof resolveSecrets>[0];
  let dir = "";
  await given(
    'a sandbox spec with the secret "LINEAR_TOKEN" from "ref:openbao/linear-token" and no OpenBao variables',
    async () => {
      spec = { template: "alpine", secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } };
      dir = await secretsDir(sut);
    },
  );

  let error: unknown;
  await when("the adapter calls resolveSecrets with the spec", async () => {
    try {
      resolveSecrets(spec, dir, { OSF_OPENBAO_ADDR: "http://bao:8200" });
    } catch (thrown) {
      error = thrown;
    }
  });

  await then(
    'it fails with a usage error that says the secret "LINEAR_TOKEN" needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"',
    async () => {
      expect((error as Error).constructor.name).toBe("UsageError");
      expect((error as Error).message).toBe('secret "LINEAR_TOKEN": needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"');
    },
  );
});
