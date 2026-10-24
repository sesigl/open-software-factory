import { scenario } from "@opensoftware/testkit";
import { demoModule, FORGE_API, FORGE_README, testCases } from "./module.ts";

scenario("SCN-TK-082", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the user and state of each review of a pull request at "DEMO_FORGE_URL"',
    async () => {
      bin = [
        ...FORGE_API,
        'const reviews = await api("GET", `/pulls/${rest[0]}/reviews`);',
        'process.stdout.write(reviews.map((review) => `${review.user.login} ${review.state}`).join("\\n"));',
        "",
      ].join("\n");
    },
  );

  await given('its system test approves a pull request in fakes.forge and expects "reviewer APPROVED"', async () => {
    const module = demoModule({
      bin,
      readme: FORGE_README,
      steps: ['When the user runs "demo"', 'Then the output is "reviewer APPROVED"'],
      test: [
        "const forge = await fakes.forge();",
        'await forge.createRepository("demo");',
        'const pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
        'await forge.review(pr, "APPROVED", "looks good");',
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  const env = { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token };",
        "  run = await sut.cli([`${forge.owner}/demo`, String(pr.number)], { env });",
        "});",
        "await then('the output is \"reviewer APPROVED\"', async () => {",
        '  expect(run.stdout, run.stderr).toBe("reviewer APPROVED");',
        "});",
      ],
    });
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

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
