import { scenario } from "@opensoftware/testkit";
import { block, LABELS, put, test } from "./repo.ts";

scenario("SCN-TRACE-024", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the background step "Given a shop with one book" and the implemented scenario "SCN-SHOP-001"',
    async () => {
      const background = "Feature: Checkout\n\n  Background:\n    Given a shop with one book\n\n";
      await put(sut, {
        "features/checkout.feature": `${background}${block("@id=SCN-SHOP-001 @status=implemented").join("\n")}\n`,
      });
    },
  );

  await given('its test starts with the step "given: a shop with one book"', async () => {
    await put(sut, {
      "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001", [["given", "a shop with one book"], ...LABELS]),
    });
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
