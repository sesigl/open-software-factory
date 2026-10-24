import { scenario } from "@opensoftware/testkit";
import { forgeEnv, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-056", async ({ sut, fakes, given, when, then }) => {
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
  await given('FACTORY_FORGEJO_ADAPTER is "/opt/missing/forge-forgejo"', async () => {
    env = { ...forgeEnv(sut, forge), FACTORY_FORGEJO_ADAPTER: "/opt/missing/forge-forgejo" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "could not start the forge adapter /opt/missing/forge-forgejo (ENOENT)"',
    async () => {
      expect(run.stderr).toContain("could not start the forge adapter /opt/missing/forge-forgejo (ENOENT)");
    },
  );
});
