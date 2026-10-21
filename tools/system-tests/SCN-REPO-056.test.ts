import { scenario } from "@opensoftware/testkit";
import { MONEY_TEST, moneyLibrary } from "./money.ts";

scenario("SCN-REPO-056", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"',
    async () => {
      for (const [path, content] of Object.entries(moneyLibrary("../src/index.ts"))) {
        await sut.files.put(`$INPUT/${path}`, content);
      }
    },
  );

  await given('its system test imports "@opensoftware/money"', async () => {
    await sut.files.put(`$INPUT/${MONEY_TEST}`, moneyLibrary("@opensoftware/money")[MONEY_TEST] as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BOUNDARY-STATIC"', async () => {
    run = await sut.cli(["check", "BOUNDARY-STATIC"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "BOUNDARY-STATIC ok"', async () => {
    expect(run.stdout).toContain("BOUNDARY-STATIC ok");
  });
});
