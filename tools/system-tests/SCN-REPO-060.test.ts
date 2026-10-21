import { scenario } from "@opensoftware/testkit";
import { moneyLibrary } from "./money.ts";

scenario("SCN-REPO-060", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the library "packages/money" named "@opensoftware/money"', async () => {
    for (const [path, content] of Object.entries(moneyLibrary("@opensoftware/money"))) {
      await sut.files.put(`$INPUT/${path}`, content);
    }
    base = await sut.git.commit("base");
  });

  await given('a change that adds "packages/money/src/extra.ts" with a function', async () => {
    await sut.files.put("$INPUT/packages/money/src/extra.ts", "export function extra() {\n  return 3;\n}\n");
  });

  await given("no coverage report", async () => {
    await sut.files.remove("$INPUT/reports");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check REACH" against the base commit', async () => {
    run = await sut.cli(["check", "REACH"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "REACH ok"', async () => {
    expect(run.stdout).toContain("REACH ok");
  });
});
