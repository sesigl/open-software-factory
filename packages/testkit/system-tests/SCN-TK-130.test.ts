import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-130", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI prints "DOCKER_HOST" and "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"', async () => {
    module = demoModule({
      bin: "process.stdout.write(`${process.env.DOCKER_HOST} ${process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE}`);\n",
      steps: ['When the user runs "demo"', 'Then the output is "unix:///run/demo/docker.sock /var/run/docker.sock"'],
      test: [
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  run = await sut.cli([]);",
        "});",
        "await then('the output is \"unix:///run/demo/docker.sock /var/run/docker.sock\"', async () => {",
        '  expect(run.stdout).toBe("unix:///run/demo/docker.sock /var/run/docker.sock");',
        "});",
      ],
    });
  });

  await given('its system test expects the output "unix:///run/demo/docker.sock /var/run/docker.sock"', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" with DOCKER_HOST "unix:///run/demo/docker.sock" and TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE "/var/run/docker.sock" in the module',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], {
        env: {
          DOCKER_HOST: "unix:///run/demo/docker.sock",
          TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE: "/var/run/docker.sock",
        },
      });
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
