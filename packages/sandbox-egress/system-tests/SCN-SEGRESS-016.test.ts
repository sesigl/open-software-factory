import { resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { secretsDir } from "./egress.ts";

scenario("SCN-SEGRESS-016", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof resolveSecrets>[0];
  let dir = "";
  await given('a sandbox spec with the secret "LINEAR_TOKEN" from "ref:env/linear.token"', async () => {
    spec = { template: "alpine", secrets: { LINEAR_TOKEN: "ref:env/linear.token" } };
    dir = await secretsDir(sut);
  });

  let error: unknown;
  await when("the adapter calls resolveSecrets with the spec", async () => {
    try {
      resolveSecrets(spec, dir, { "OSF_SECRET_linear.token": "x" });
    } catch (thrown) {
      error = thrown;
    }
  });

  await then('it fails with a usage error that says "linear.token" is no variable name', async () => {
    expect((error as Error).constructor.name).toBe("UsageError");
    expect((error as Error).message).toBe(
      'secret "LINEAR_TOKEN": "linear.token" is no variable name; use A to Z, 0 to 9 and _',
    );
  });
});
