import { scenario } from "@opensoftware/testkit";
import { block, feature, put, test } from "./repo.ts";

scenario("SCN-TRACE-017", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario "SCN-SHOP-001" in "shop/features/checkout.feature" and its test in "tests/"',
    async () => {
      await put(sut, {
        "shop/features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  await given('a spec-trace.json with the test folder "system-tests"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ testFolder: "system-tests" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE tests/SCN-SHOP-001.test.ts:3 the test of SCN-SHOP-001 must live in shop/system-tests/"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE tests/SCN-SHOP-001.test.ts:3 the test of SCN-SHOP-001 must live in shop/system-tests/",
      );
    },
  );
});
