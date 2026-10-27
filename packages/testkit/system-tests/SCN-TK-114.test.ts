import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-114", async ({ sut, given, when, then }) => {
  let compose = "";
  await given(
    'a module whose "compose.yaml" has the service "events", a NATS server that publishes its port 8222',
    async () => {
      compose = [
        "services:",
        "  events:",
        "    image: nats:2.11.9-alpine",
        "    command: [--http_port=8222]",
        "    ports: ['127.0.0.1::8222']",
        "    healthcheck:",
        "      test: [CMD-SHELL, 'wget -q -O /dev/null http://127.0.0.1:8222/healthz']",
        "      interval: 1s",
        "      retries: 30",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test runs "up --detach --wait" with sut.compose, reads "/healthz" at the URL of "events" port 8222 and expects "ok"',
    async () => {
      const module = demoModule({
        steps: ['When the user starts "compose.yaml"', 'Then "/healthz" of "events" says "ok"'],
        test: [
          'const compose = sut.compose("compose.yaml");',
          "await when('the user starts \"compose.yaml\"', async () => {",
          '  const up = await compose.run(["up", "--detach", "--wait"]);',
          "  expect(up.exitCode, up.stderr).toBe(0);",
          "});",
          'await then(\'"/healthz" of "events" says "ok"\', async () => {',
          '  const response = await fetch(`${await compose.url("events", 8222)}/healthz`);',
          '  expect(await response.json()).toEqual({ status: "ok" });',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
      await sut.files.put("$INPUT/compose.yaml", compose);
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
