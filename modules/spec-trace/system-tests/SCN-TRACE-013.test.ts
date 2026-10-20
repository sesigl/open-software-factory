import { scenario } from "@opensoftware/testkit";
import { block, feature, put, test } from "./repo.ts";

scenario("SCN-TRACE-013", async ({ sut, given, when, then }) => {
  await given('a repository with a test for "SCN-SHOP-002" and no scenario with that ID', async () => {
    await put(sut, {
      "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=planned")),
      "tests/SCN-SHOP-002.test.ts": test("SCN-SHOP-002"),
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "TRACE tests/SCN-SHOP-002.test.ts:3 SCN-SHOP-002 names no scenario"', async () => {
    expect(run.stdout).toContain("TRACE tests/SCN-SHOP-002.test.ts:3 SCN-SHOP-002 names no scenario");
  });
});
