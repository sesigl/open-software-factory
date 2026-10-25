import { scenario } from "@opensoftware/testkit";
import { demoModule, FORGE_API, FORGE_README, testCases } from "./module.ts";

scenario("SCN-TK-098", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the user and text of each comment of a pull request at "DEMO_FORGE_URL"',
    async () => {
      bin = [
        ...FORGE_API,
        'const comments = await api("GET", `/issues/${rest[0]}/comments`);',
        'process.stdout.write(comments.map((comment) => `${comment.user.login} ${comment.body}`).join("\\n"));',
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test has "reviewer" say "Looks good" on a pull request in fakes.forge and expects "reviewer Looks good"',
    async () => {
      const module = demoModule({
        bin,
        readme: FORGE_README,
        steps: ['When the user runs "demo"', 'Then the output is "reviewer Looks good"'],
        test: [
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo");',
          'const pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          'await forge.say(pr, "Looks good");',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token };",
          "  run = await sut.cli([`${forge.owner}/demo`, String(pr.number)], { env });",
          "});",
          "await then('the output is \"reviewer Looks good\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("reviewer Looks good");',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
