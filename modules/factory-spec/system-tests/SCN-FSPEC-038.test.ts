import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, forgeEnv, hooksOf, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-038", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  await given('the factory was applied with a webhook on the Forgejo repository "tester/web"', async () => {
    await appliedWithHook(sut, forge);
  });

  await given("the factory engineer removed the automation from factory.yaml", async () => {
    await putForgeFactory(sut, forge.owner, false);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env: forgeEnv(forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"tester/web" has no webhook', async () => {
    expect(await hooksOf(forge)).toEqual([]);
  });
});
