import { scenario } from "@opensoftware/testkit";
import { appliedWithGitHubHook, changeGitHubHookUrl, githubEnv, INTAKE } from "./forge.ts";

scenario("SCN-FSPEC-052", async ({ sut, fakes, given, when, then }) => {
  const github = await fakes.github();
  await given('the factory was applied with a webhook on the GitHub repository "tester/web"', async () => {
    await appliedWithGitHubHook(sut, github);
  });

  await given('a person changed the URL of the webhook to "http://elsewhere.example/hook" on GitHub', async () => {
    await changeGitHubHookUrl(github, "http://elsewhere.example/hook");
  });

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
