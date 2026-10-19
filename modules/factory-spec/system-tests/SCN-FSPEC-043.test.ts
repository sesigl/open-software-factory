import { scenario } from "@opensoftware/testkit";
import { forgeEnv, hooks, INTAKE, putFactory } from "./forge.ts";

scenario("SCN-FSPEC-043", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();

  await given('a Forgejo repository "tester/web-app"', async () => {
    await forge.createRepository("web-app");
  });

  await given(
    'a factory.yaml whose agent "implement" works on "tester/web-app" and has the automation on "forgejo.issue.labeled(auto-implement)"',
    async () => {
      await putFactory(sut, forge.owner, ["forgejo.issue.labeled(auto-implement)"]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the factory engineer runs "factory apply" with the intake URL "http://intake.example.invalid/hooks"',
    async () => {
      run = await sut.cli(["apply"], { env: forgeEnv(forge) });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "webhook of tester/web-app: created"', async () => {
    expect(run.stdout).toContain("webhook of tester/web-app: created");
  });

  await then(
    'the repository "tester/web-app" has one webhook to "http://intake.example.invalid/hooks" for the event "issue_label"',
    async () => {
      expect(await hooks(forge)).toEqual([
        expect.objectContaining({
          config: expect.objectContaining({ url: INTAKE }),
          events: ["issue_label"],
          active: true,
        }),
      ]);
    },
  );
});
