import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-045", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI prints whether a pull request at "DEMO_FORGE_URL" is merged and its merge commit',
    async () => {
      module = demoModule({
        bin: [
          "const [repository, number] = process.argv.slice(2);",
          "const pr = await fetch(`${process.env.DEMO_FORGE_URL}/api/v1/repos/${repository}/pulls/${number}`).then((r) => r.json());",
          'console.log(`${pr.merged ? "merged" : "open"} ${pr.merge_commit_sha}`);',
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_FORGE_URL` | Forge base URL. |",
          "",
        ].join("\n"),
        steps: ['When the user runs "demo"', 'Then the output says "merged" and the merge commit'],
        test: [
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo", { "notes.md": "hello\\n" });',
          'const pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "fix.md": "fixed\\n" } });',
          "const merge = await forge.mergePullRequest(pr);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([`${forge.owner}/demo`, String(pr.number)], { env: { DEMO_FORGE_URL: forge.url } });",
          "});",
          'await then("the output says \\"merged\\" and the merge commit", async () => {',
          "  expect(merge).toMatch(/^[0-9a-f]{40}$/);",
          "  expect(run.stdout.trim()).toBe(`merged ${merge}`);",
          "});",
        ],
      });
    },
  );

  await given(
    'its system test merges a pull request in fakes.forge and expects "merged" and the merge commit it got back',
    async () => {
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
