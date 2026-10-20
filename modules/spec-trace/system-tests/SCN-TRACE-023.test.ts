import { scenario } from "@opensoftware/testkit";
import { block, feature, LABELS, put, test } from "./repo.ts";

scenario("SCN-TRACE-023", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario outline "SCN-SHOP-001" with the step "When the guest pays with <method>"',
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
      });
    },
  );

  await given('its test labels that step "the guest pays with a card"', async () => {
    await put(sut, { "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001", LABELS) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only STEPS"', async () => {
    run = await sut.cli(["check", "--only", "STEPS"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "STEPS ok"', async () => {
    expect(run.stdout).toContain("STEPS ok");
  });
});
