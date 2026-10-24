import { scenario } from "@opensoftware/testkit";
import { forgeEnv, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-055", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  await given('a Forgejo repository "tester/web"', async () => {
    await forge.createRepository("web");
  });

  await given(
    'a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"',
    async () => {
      await putForgeFactory(sut, forge.owner);
    },
  );

  let env: Record<string, string> = {};
  await given("FACTORY_WEBHOOK_SECRET is not set", async () => {
    const { FACTORY_WEBHOOK_SECRET: _, ...rest } = forgeEnv(sut, forge);
    env = rest;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "set FACTORY_WEBHOOK_SECRET to the secret that signs the webhooks of automations"',
    async () => {
      expect(run.stderr).toContain("set FACTORY_WEBHOOK_SECRET to the secret that signs the webhooks of automations");
      expect(await forge.hooks("web")).toEqual([]);
    },
  );
});
