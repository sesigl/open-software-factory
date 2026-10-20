import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-046", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the scenarios "SCN-SHOP-001", the deprecated "SCN-SHOP-007" and "SCN-CART-009"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=planned"),
          block("@id=SCN-SHOP-007 @status=deprecated"),
          block("@id=SCN-CART-009 @status=planned"),
        ),
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace next-id SHOP"', async () => {
    run = await sut.cli(["next-id", "SHOP"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "SCN-SHOP-008"', async () => {
    expect(run.stdout).toBe("SCN-SHOP-008\n");
  });
});
