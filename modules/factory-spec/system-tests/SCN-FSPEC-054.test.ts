import { scenario } from "@opensoftware/testkit";
import { githubEnv, putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-054", async ({ sut, fakes, given, when, then }) => {
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
  await when('the factory engineer runs "factory apply --gh-aw"', async () => {
    run = await sut.cli(["apply", "--gh-aw"], { env: githubEnv(sut, github) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"tester/web" on GitHub has no webhook', async () => {
    expect(await github.hooks("web")).toEqual([]);
    expect(await sut.files.list("$OUTPUT/.github/workflows")).toEqual(["issue-labeled-auto-implement.md"]);
  });
});
