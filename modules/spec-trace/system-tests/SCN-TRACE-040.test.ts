import { scenario } from "@opensoftware/testkit";
import { block, feature, put, readReport, test } from "./repo.ts";

scenario("SCN-TRACE-040", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario outline "SCN-SHOP-001" with three examples and its test',
    async () => {
      const steps = [
        "Given a cart with one book",
        "When the guest pays with <method>",
        "Then the order is paid",
        "",
        "    Examples:",
        "      | method   |",
        "      | a card   |",
        "      | cash     |",
        "      | a coupon |",
      ];
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=implemented", steps, "Scenario Outline: A guest pays"),
        ),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report"', async () => {
    run = await sut.cli(["report"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the report counts 1 scenario and lists "SCN-SHOP-001" with 3 examples', async () => {
    const report = await readReport(sut);
    expect(report.totals.scenarios).toBe(1);
    expect(report.scenarios).toMatchObject([{ id: "SCN-SHOP-001", examples: 3 }]);
  });
});
