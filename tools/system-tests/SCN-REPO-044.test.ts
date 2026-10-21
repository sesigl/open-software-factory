import { scenario } from "@opensoftware/testkit";
import { DEMO_PACKAGE, qualityLimits, summingFunction } from "./repo.ts";

scenario("SCN-REPO-044", async ({ sut, given, when, then }) => {
  await given('a module "demo" with the limit "Duplication: at most 3%"', async () => {
    await sut.files.put("$INPUT/modules/demo/package.json", DEMO_PACKAGE);
    await sut.files.put("$INPUT/modules/demo/AGENTS.md", qualityLimits({ duplication: 3 }));
  });

  await given('"modules/demo/src/sum.ts" holds the same function twice under two names', async () => {
    await sut.files.put("$INPUT/modules/demo/src/sum.ts", `${summingFunction("sumA")}\n${summingFunction("sumB")}`);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DUP"', async () => {
    run = await sut.cli(["check", "DUP"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "of the lines of modules/demo are duplicated, the limit is 3%"', async () => {
    expect(run.stdout).toContain("of the lines of modules/demo are duplicated, the limit is 3%");
  });

  await then('the output contains "duplicate modules/demo/src/sum.ts"', async () => {
    expect(run.stdout).toContain("duplicate modules/demo/src/sum.ts");
  });
});
