import { scenario } from "@opensoftware/testkit";
import { githubEnv, INTAKE, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-050", async ({ sut, fakes, given, when, then }) => {
  const github = await fakes.github();
  await given('a GitHub repository "tester/web"', async () => {
    await github.createRepository("web");
  });

  await given(
    'a factory.yaml whose agent "triage" operates on "tester/web" and the automation "github.issue.labeled(auto-implement)"',
    async () => {
      await putForgeFactory(sut, github.owner, true, "github");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env: githubEnv(sut, github) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"tester/web" on GitHub has one webhook to "http://intake.example/webhooks/forge" for the events "issues"',
    async () => {
      expect(await github.hooks("web")).toEqual([{ url: INTAKE, events: ["issues"], active: true }]);
    },
  );
});
