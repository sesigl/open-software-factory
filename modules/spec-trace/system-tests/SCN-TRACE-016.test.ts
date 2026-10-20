import { scenario } from "@opensoftware/testkit";
import { block, feature, put, test } from "./repo.ts";

scenario("SCN-TRACE-016", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the planned scenario "SCN-SHOP-001" and its test and the planned scenario "SCN-SHOP-002" without one',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=planned"),
          block("@id=SCN-SHOP-002 @status=planned"),
        ),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "TRACE ok"', async () => {
    expect(run.stdout).toContain("TRACE ok");
  });
});
