import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, forgeApi, forgeEnv, hooks } from "./forge.ts";

scenario("SCN-FSPEC-046", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();

  await given(
    'the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"',
    async () => {
      await appliedWithHook(sut, forge);
    },
  );

  await given('a person deactivated the webhook of "tester/web-app" in Forgejo', async () => {
    const [hook] = await hooks(forge);
    await forgeApi(forge, "PATCH", `/hooks/${hook?.id}`, { active: false });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: forgeEnv(forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "! webhook of tester/web-app changed outside \\"factory apply\\""', async () => {
    expect(run.stdout).toContain('! webhook of tester/web-app changed outside "factory apply"');
  });

  await then('the output contains "Plan: 0 to add, 0 to change, 0 to remove, 1 drifted."', async () => {
    expect(run.stdout).toContain("Plan: 0 to add, 0 to change, 0 to remove, 1 drifted.");
  });
});
