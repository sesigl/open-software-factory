import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-167", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI reads the ref and the commit of "fix", makes a tree on its tree that changes "notes.md" and adds "docs/new.md", a commit of it on the branch\'s head, moves "fix" there without force, and prints the status and whether the ref and the parent are right at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const head = await api("GET", "/git/ref/heads/fix");',
        "const parent = head.json.object.sha;",
        'const base = await api("GET", `/git/commits/${parent}`);',
        'const tree = await api("POST", "/git/trees", {',
        "  base_tree: base.json.tree.sha,",
        "  tree: [",
        '    { path: "notes.md", mode: "100644", type: "blob", content: "changed\\n" },',
        '    { path: "docs/new.md", mode: "100644", type: "blob", content: "new\\n" },',
        "  ],",
        "});",
        'const made = await api("POST", "/git/commits", { message: "Change notes", tree: tree.json.sha, parents: [parent] });',
        'const moved = await api("PATCH", "/git/refs/heads/fix", { sha: made.json.sha, force: false });',
        'const written = await api("GET", `/git/commits/${made.json.sha}`);',
        "const ref = moved.json.object.sha === made.json.sha;",
        "process.stdout.write(`${moved.status} ${ref} ${written.json.parents[0].sha === parent}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test creates the branch "fix" with "notes.md" in fakes.github and expects "200 true true", both files on "fix", "README.md" kept and "main" unchanged',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "200 true true" and "fix" holds the commit'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          'await then(\'the output is "200 true true" and "fix" holds the commit\', async () => {',
          '  expect(run.stdout).toBe("200 true true");',
          '  expect(await github.file("demo", "notes.md", "fix")).toBe("changed\\n");',
          '  expect(await github.file("demo", "docs/new.md", "fix")).toBe("new\\n");',
          '  expect(await github.file("demo", "README.md", "fix")).toBe("# demo\\n");',
          '  expect(await github.file("demo", "notes.md", "main")).toBeUndefined();',
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
