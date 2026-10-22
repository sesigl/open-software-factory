import { scenario } from "@opensoftware/testkit";
import { MONEY_TEST, moneyLibrary } from "./money.ts";

scenario("SCN-REPO-061", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"',
    async () => {
      for (const [path, content] of Object.entries(moneyLibrary("../src/index.ts"))) {
        await sut.files.put(`$INPUT/${path}`, content);
      }
    },
  );

  await given(
    'its system test asserts on the value that "cents" from "@opensoftware/money/rates" returned',
    async () => {
      await sut.files.put(`$INPUT/${MONEY_TEST}`, moneyLibrary("@opensoftware/money/rates")[MONEY_TEST] as string);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ASSERT"', async () => {
    run = await sut.cli(["check", "ASSERT"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "ASSERT ok"', async () => {
    expect(run.stdout).toContain("ASSERT ok");
  });
});
