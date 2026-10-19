import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, forgeEnv, hooks, INTAKE, putFactory } from "./forge.ts";

scenario("SCN-FSPEC-045", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();

  await given(
    'the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"',
    async () => {
      await appliedWithHook(sut, forge);
    },
  );

  await given('the factory engineer changed the automation to "forgejo.push"', async () => {
    await putFactory(sut, forge.owner, ["forgejo.push"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env: forgeEnv(forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the repository "tester/web-app" has one webhook to "http://intake.example.invalid/hooks" for the event "push"',
    async () => {
      expect(await hooks(forge)).toEqual([
        expect.objectContaining({ config: expect.objectContaining({ url: INTAKE }), events: ["push"] }),
      ]);
    },
  );
});
