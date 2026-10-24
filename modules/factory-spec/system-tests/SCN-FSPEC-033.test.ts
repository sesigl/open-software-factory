import { scenario } from "@opensoftware/testkit";
import { forgeEnv, hooksOf, INTAKE, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-033", async ({ sut, fakes, given, when, then }) => {
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
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env: forgeEnv(sut, forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"tester/web" has one webhook to "http://intake.example/webhooks/forge" for the events "issue_label"',
    async () => {
      expect((await hooksOf(forge)).map(({ url, events }) => ({ url, events }))).toEqual([
        { url: INTAKE, events: ["issue_label"] },
      ]);
    },
  );
});
