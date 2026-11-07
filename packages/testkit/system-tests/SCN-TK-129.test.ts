import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-129", async ({ sut, given, when, then }) => {
  await given(
    'a module whose system test starts fakes.s3 and expects that the label "org.opensoftware.run=r7" finds its container',
    async () => {
      const module = demoModule({
        steps: ["When the test starts fakes.s3", 'Then the label "org.opensoftware.run=r7" finds its container'],
        test: [
          'const { execFileSync } = await import("node:child_process");',
          'await when("the test starts fakes.s3", async () => {',
          "  await fakes.s3();",
          "});",
          "await then('the label \"org.opensoftware.run=r7\" finds its container', async () => {",
          '  const images = execFileSync("docker", ["ps", "--filter", "label=org.opensoftware.run=r7", "--format", "{{.Image}}"], {',
          '    encoding: "utf8",',
          "  });",
          '  expect(images).toContain("seaweedfs");',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" with OSF_TESTKIT_RUN "r7" in the module',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], { env: { OSF_TESTKIT_RUN: "r7" } });
    },
  );

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
