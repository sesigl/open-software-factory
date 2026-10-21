import { scenario } from "@opensoftware/testkit";
import { MONEY_TEST, moneyLibrary } from "./money.ts";

scenario("SCN-REPO-057", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"',
    async () => {
      for (const [path, content] of Object.entries(moneyLibrary("@opensoftware/money"))) {
        await sut.files.put(`$INPUT/${path}`, content);
      }
    },
  );

  await given('its system test imports "../src/index.ts"', async () => {
    await sut.files.put(`$INPUT/${MONEY_TEST}`, moneyLibrary("../src/index.ts")[MONEY_TEST] as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BOUNDARY-STATIC"', async () => {
    run = await sut.cli(["check", "BOUNDARY-STATIC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "BOUNDARY-STATIC packages/money/system-tests/SCN-MONEY-001.test.ts:2"', async () => {
    expect(run.stdout).toContain("BOUNDARY-STATIC packages/money/system-tests/SCN-MONEY-001.test.ts:2");
  });
});
