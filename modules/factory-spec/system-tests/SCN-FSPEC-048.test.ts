import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, forgeEnv, hooks, putFactory } from "./forge.ts";

scenario("SCN-FSPEC-048", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();

  await given(
    'the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"',
    async () => {
      await appliedWithHook(sut, forge);
    },
  );

  await given("the factory engineer removed the automation from factory.yaml", async () => {
    await putFactory(sut, forge.owner, []);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env: forgeEnv(forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "webhook of tester/web-app: deleted"', async () => {
    expect(run.stdout).toContain("webhook of tester/web-app: deleted");
  });

  await then('the repository "tester/web-app" has no webhook', async () => {
    expect(await hooks(forge)).toEqual([]);
  });
});
