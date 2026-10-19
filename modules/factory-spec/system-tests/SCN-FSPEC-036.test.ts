import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, deleteHook, forgeEnv } from "./forge.ts";

scenario("SCN-FSPEC-036", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  await given('the factory was applied with a webhook on the Forgejo repository "tester/web"', async () => {
    await appliedWithHook(sut, forge);
  });

  await given("a person deleted the webhook in Forgejo", async () => {
    await deleteHook(forge);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: forgeEnv(forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "! webhook tester/web was deleted outside \\"factory apply\\""', async () => {
    expect(run.stdout).toContain('! webhook tester/web was deleted outside "factory apply"');
  });
});
