import { scenario } from "@opensoftware/testkit";
import { block, feature, junit, put, test } from "./repo.ts";

scenario("SCN-TRACE-030", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario outline "SCN-SHOP-001" with two examples and its test',
    async () => {
      const steps = [
        "Given a cart with one book",
        "When the guest pays with <method>",
        "Then the order is paid",
        "",
        "    Examples:",
        "      | method |",
        "      | a card |",
        "      | cash   |",
      ];
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=implemented", steps, "Scenario Outline: A guest pays"),
        ),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  await given('a JUnit report with a passed and a failed test case for "SCN-SHOP-001"', async () => {
    await sut.files.put(
      "$INPUT/reports/junit/checkout.xml",
      junit([{ id: "SCN-SHOP-001" }, { id: "SCN-SHOP-001", body: "<failure/>" }]),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only PASS"', async () => {
    run = await sut.cli(["check", "--only", "PASS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 failed"', async () => {
    expect(run.stdout).toContain("PASS features/checkout.feature:4 SCN-SHOP-001 failed");
  });
});
