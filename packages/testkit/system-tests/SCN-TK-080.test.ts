import { scenario } from "@opensoftware/testkit";
import { demoModule, FORGE_API, FORGE_README, testCases } from "./module.ts";

scenario("SCN-TK-080", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI registers a webhook for pull request events of a repository at "DEMO_FORGE_URL" to the URL it is given',
    async () => {
      bin = [
        ...FORGE_API,
        'await api("POST", "/hooks", {',
        '  type: "forgejo",',
        '  config: { url: rest[0], content_type: "json" },',
        '  events: ["pull_request"],',
        "  active: true,",
        "});",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test passes the container URL of a fake for containers, opens a pull request in fakes.forge and expects a delivery with the event "pull_request"',
    async () => {
      const module = demoModule({
        bin,
        readme: FORGE_README,
        steps: [
          'When the user runs "demo" and opens a pull request',
          'Then the receiver gets a "pull_request" delivery',
        ],
        test: [
          'const receiver = await fakes.http([{ method: "POST", path: "/forge", body: {} }], { containers: true });',
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo");',
          "await when('the user runs \"demo\" and opens a pull request', async () => {",
          "  const env = { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token };",
          "  await sut.cli([`${forge.owner}/demo`, `${receiver.containerUrl}/forge`], { env });",
          '  await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          "});",
          "await then('the receiver gets a \"pull_request\" delivery', async () => {",
          '  await expect.poll(() => receiver.headers().map((request) => request.headers["x-forgejo-event"]), { timeout: 20_000 })',
          '    .toContain("pull_request");',
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
