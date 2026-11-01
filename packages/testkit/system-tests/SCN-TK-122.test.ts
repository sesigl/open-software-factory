import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

/** A Docker CLI plugin: it answers Docker's metadata call, and every other call with its version line. */
const PLUGIN = [
  "#!/bin/sh",
  'if [ "$1" = docker-cli-plugin-metadata ]; then',
  '  echo \'{"SchemaVersion":"0.1.0","Vendor":"testkit","Version":"9.9.9","ShortDescription":"fake"}\'',
  "  exit 0",
  "fi",
  'echo "fake compose 9.9.9"',
  "",
].join("\n");

scenario("SCN-TK-122", async ({ sut, given, when, then }) => {
  await given(
    'a Docker configuration folder whose plugin "cli-plugins/docker-compose" answers "fake compose 9.9.9"',
    async () => {
      await sut.files.put("$INPUT/docker/cli-plugins/docker-compose", PLUGIN, { executable: true });
    },
  );

  await given(
    'a module whose system test runs "version" with sut.compose and expects "fake compose 9.9.9"',
    async () => {
      const module = demoModule({
        steps: ['When the user runs "version" on "compose.yaml"', 'Then the output is "fake compose 9.9.9"'],
        test: [
          'const compose = sut.compose("compose.yaml");',
          "let version: Awaited<ReturnType<typeof compose.run>>;",
          'await when(\'the user runs "version" on "compose.yaml"\', async () => {',
          '  version = await compose.run(["version"]);',
          "});",
          "await then('the output is \"fake compose 9.9.9\"', async () => {",
          '  expect(version.stdout.trim(), version.stderr).toBe("fake compose 9.9.9");',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
      await sut.files.put("$INPUT/compose.yaml", "services:\n  events:\n    image: nats:2.11.9-alpine\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" in the module with "DOCKER_CONFIG" set to that folder',
    async () => {
      const env = { DOCKER_CONFIG: sut.files.path("$INPUT/docker") };
      run = await sut.cli(["run", "--junit", "report.xml"], { env });
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
