import { scenario } from "@opensoftware/testkit";
import { apiModule, testCases } from "./module.ts";

scenario("SCN-TK-126", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI gets "/v0.1/servers?search=tracker" from the API at "DEMO_API_URL" and prints the body',
    async () => {
      // The fake reads the body when it answers. Without the hold it has sent {"count":0} before the test sees the
      // request, so the demo's test passes only when the answer waited for `held`.
      module = apiModule(
        '[{ path: "/v0.1/servers?search=tracker", body: answer, until: held }]',
        [
          "const answer = { count: 0 };",
          "let release = () => {};",
          "const held = new Promise<void>((resolve) => { release = resolve; });",
        ],
        [
          "const running = sut.cli([], { env: { DEMO_API_URL: api.url } });",
          "await expect.poll(() => api.requests().length).toBe(1);",
          "answer.count = 1;",
          "release();",
          "run = await running;",
        ],
      );
    },
  );

  await given(
    'its system test holds the answer {"count":0} until the fake has the request, then changes it to {"count":1}',
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
