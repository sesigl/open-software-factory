import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-087", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI registers a webhook for "pull_request" events with a secret to the URL it is given at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'await api("POST", "/hooks", {',
        '  name: "web",',
        '  config: { url: rest[0], content_type: "json", secret: "whsec-demo" },',
        '  events: ["pull_request"],',
        "  active: true,",
        "});",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test passes the URL of fakes.http, opens a pull request in fakes.github and expects the events "ping" and "pull_request" with a "sha256=" signature',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo" and opens a pull request',
          'Then the receiver gets a signed "ping" and a signed "pull_request" delivery',
        ],
        test: [
          'const receiver = await fakes.http([{ method: "POST", path: "/github", body: {} }]);',
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          "await when('the user runs \"demo\" and opens a pull request', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  await sut.cli([`${github.owner}/demo`, `${receiver.url}/github`], { env });",
          '  await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          "});",
          'await then(\'the receiver gets a signed "ping" and a signed "pull_request" delivery\', async () => {',
          "  await expect.poll(() => receiver.headers().length, { timeout: 10_000 }).toBe(2);",
          '  expect(receiver.headers().map((request) => request.headers["x-github-event"])).toEqual(["ping", "pull_request"]);',
          '  for (const request of receiver.headers()) expect(request.headers["x-hub-signature-256"]).toMatch(/^sha256=[0-9a-f]{64}$/);',
          '  expect(await github.hooks("demo")).toEqual([{ url: `${receiver.url}/github`, events: ["pull_request"], active: true }]);',
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
