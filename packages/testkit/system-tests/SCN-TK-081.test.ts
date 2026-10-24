import { scenario } from "@opensoftware/testkit";
import { demoModule, FORGE_API, FORGE_README, testCases } from "./module.ts";

scenario("SCN-TK-081", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI creates the branch "release" from "main" and a webhook to "http://intake.example/forge" at "DEMO_FORGE_URL"',
    async () => {
      bin = [
        ...FORGE_API,
        'await api("POST", "/branches", { new_branch_name: "release", old_ref_name: "main" });',
        'await api("POST", "/hooks", {',
        '  type: "forgejo",',
        '  config: { url: "http://intake.example/forge", content_type: "json" },',
        '  events: ["pull_request"],',
        "  active: true,",
        "});",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test creates the branch "fix" with "notes.md" in fakes.forge and expects the branches "fix", "main" and "release" with their head commits and that webhook',
    async () => {
      const module = demoModule({
        bin,
        readme: FORGE_README,
        steps: ['When the user runs "demo"', "Then the forge lists the three branches and the webhook"],
        test: [
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo");',
          'const main = (await forge.branches("demo"))[0]?.sha;',
          'const fix = await forge.createBranch("demo", { branch: "fix", files: { "notes.md": "hi\\n" } });',
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token };",
          "  await sut.cli([`${forge.owner}/demo`], { env });",
          "});",
          "await then('the forge lists the three branches and the webhook', async () => {",
          "  expect(fix).not.toBe(main);",
          '  expect(await forge.file("demo", "notes.md", "fix")).toBe("hi\\n");',
          '  expect(await forge.branches("demo")).toEqual([',
          '    { name: "fix", sha: fix },',
          '    { name: "main", sha: main },',
          '    { name: "release", sha: main },',
          "  ]);",
          '  expect(await forge.hooks("demo")).toEqual([',
          '    expect.objectContaining({ url: "http://intake.example/forge", active: true }),',
          "  ]);",
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
