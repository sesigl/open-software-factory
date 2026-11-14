import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-174", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI posts the bytes "ff fe 00 80 41 0a c3 28" as a base64 blob, makes a tree on the tree of "fix" with "logo.bin" as that blob, commits it on "fix", moves "fix" there, and prints the blob\'s status and SHA at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const content = Buffer.from("fffe0080410ac328", "hex").toString("base64");',
        'const blob = await api("POST", "/git/blobs", { content, encoding: "base64" });',
        'const head = await api("GET", "/git/ref/heads/fix");',
        "const parent = head.json.object.sha;",
        'const base = await api("GET", `/git/commits/${parent}`);',
        'const tree = await api("POST", "/git/trees", {',
        "  base_tree: base.json.tree.sha,",
        '  tree: [{ path: "logo.bin", mode: "100644", type: "blob", sha: blob.json.sha }],',
        "});",
        'const made = await api("POST", "/git/commits", { message: "Add the logo", tree: tree.json.sha, parents: [parent] });',
        'await api("PATCH", "/git/refs/heads/fix", { sha: made.json.sha });',
        "process.stdout.write(`${blob.status} ${blob.json.sha}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test creates the branch "fix" in fakes.github and expects "201 702e1e879fdef58f4ee3b5229825b123b436cf5d", Git\'s SHA of these bytes, and the bytes of "logo.bin" on "fix"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output names the blob and "fix" holds its bytes'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          "await then('the output names the blob and \"fix\" holds its bytes', async () => {",
          '  expect(run.stdout).toBe("201 702e1e879fdef58f4ee3b5229825b123b436cf5d");',
          '  const bytes = await github.fileBytes("demo", "logo.bin", "fix");',
          '  expect(bytes?.toString("hex")).toBe("fffe0080410ac328");',
          '  expect(await github.file("demo", "notes.md", "fix")).toBe("hello\\n");',
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
