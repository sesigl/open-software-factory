import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-012", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI comments "evidence bundle attached" and sets the status "proof" to "success" on a pull request at "DEMO_FORGE_URL"',
    async () => {
      module = demoModule({
        bin: [
          "const [repository, number] = process.argv.slice(2);",
          "const api = (method, path, body) =>",
          "  fetch(`${process.env.DEMO_FORGE_URL}/api/v1/repos/${repository}${path}`, {",
          "    method,",
          '    headers: { authorization: `token ${process.env.DEMO_FORGE_TOKEN}`, "content-type": "application/json" },',
          "    body: body && JSON.stringify(body),",
          "  }).then((response) => response.json());",
          'const pr = await api("GET", `/pulls/${number}`);',
          'await api("POST", `/issues/${number}/comments`, { body: "evidence bundle attached" });',
          'await api("POST", `/statuses/${pr.head.sha}`, { state: "success", context: "proof", description: "ok" });',
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
          "| `DEMO_FORGE_TOKEN` | Forge API token. |",
          "",
        ].join("\n"),
        steps: [
          'When the user runs "demo"',
          'Then the pull request has the comment "evidence bundle attached" and the status "proof" with "success"',
        ],
        test: [
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo");',
          'const pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([`${forge.owner}/demo`, String(pr.number)], { env: { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token } });",
          "});",
          'await then("the pull request has the comment \\"evidence bundle attached\\" and the status \\"proof\\" with \\"success\\"", async () => {',
          '  expect(await forge.comments(pr)).toContain("evidence bundle attached");',
          '  expect(await forge.statuses(pr)).toContainEqual(expect.objectContaining({ context: "proof", state: "success" }));',
          "});",
        ],
      });
    },
  );

  await given(
    "its system test opens a pull request in fakes.forge and expects that comment and that status",
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
