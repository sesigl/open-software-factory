import { scenario } from "@opensoftware/testkit";
import { forgeEnv, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-047", async ({ sut, fakes, given, when, then }) => {
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

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply" with the token "not-a-token"', async () => {
    run = await sut.cli(["apply"], { env: forgeEnv(forge, "not-a-token") });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "Forgejo answered 401 to POST tester/web/hooks"', async () => {
    expect(run.stderr).toContain("Forgejo answered 401 to POST tester/web/hooks");
  });
});
