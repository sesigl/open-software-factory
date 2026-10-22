import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-050", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI commits "notes.md" with "hello" on the new branch "fix" and opens a pull request "Fix the notes" into "main" at "DEMO_FORGE_URL"',
    async () => {
      module = demoModule({
        bin: [
          "const [repository] = process.argv.slice(2);",
          "const api = (path, body) =>",
          "  fetch(`${process.env.DEMO_FORGE_URL}/api/v1/repos/${repository}${path}`, {",
          '    method: "POST",',
          '    headers: { authorization: `token ${process.env.DEMO_FORGE_TOKEN}`, "content-type": "application/json" },',
          "    body: JSON.stringify(body),",
          "  }).then((response) => response.json());",
          'const content = Buffer.from("hello\\n").toString("base64");',
          'await api("/contents", { branch: "main", new_branch: "fix", message: "notes", files: [{ operation: "create", path: "notes.md", content }] });',
          'await api("/pulls", { base: "main", head: "fix", title: "Fix the notes", body: "Adds the notes." });',
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
          'Then the forge has the pull request "Fix the notes" from "fix" into "main" and "notes.md" only on "fix"',
        ],
        test: [
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo");',
          "await when('the user runs \"demo\"', async () => {",
          "  const run = await sut.cli([`${forge.owner}/demo`], { env: { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token } });",
          "  expect(run.exitCode, run.stderr).toBe(0);",
          "});",
          'await then("the forge has the pull request \\"Fix the notes\\" from \\"fix\\" into \\"main\\" and \\"notes.md\\" only on \\"fix\\"", async () => {',
          '  expect(await forge.pullRequests("demo")).toEqual([',
          '    expect.objectContaining({ number: 1, title: "Fix the notes", body: "Adds the notes.", head: "fix", base: "main", state: "open" }),',
          "  ]);",
          '  expect(await forge.file("demo", "notes.md", "fix")).toBe("hello\\n");',
          '  expect(await forge.file("demo", "notes.md", "main")).toBeUndefined();',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test expects that pull request in fakes.forge and "notes.md" with "hello" only on the branch "fix"',
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
