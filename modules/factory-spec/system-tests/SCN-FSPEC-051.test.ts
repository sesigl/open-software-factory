import { scenario } from "@opensoftware/testkit";
import { appliedWithGitHubHook, changeGitHubHookUrl, githubEnv } from "./forge.ts";

scenario("SCN-FSPEC-051", async ({ sut, fakes, given, when, then }) => {
  const github = await fakes.github();
  await given('the factory was applied with a webhook on the GitHub repository "tester/web"', async () => {
    await appliedWithGitHubHook(sut, github);
  });

  await given('a person changed the URL of the webhook to "http://elsewhere.example/hook" on GitHub', async () => {
    await changeGitHubHookUrl(github, "http://elsewhere.example/hook");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: githubEnv(sut, github) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output contains "! webhook github:tester/web.url: \\"http://intake.example/webhooks/forge\\" -> \\"http://elsewhere.example/hook\\""',
    async () => {
      expect(run.stdout).toContain(
        '! webhook github:tester/web.url: "http://intake.example/webhooks/forge" -> "http://elsewhere.example/hook"',
      );
    },
  );
});
