import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-142", async ({ sut, given, when, then }) => {
  await given(
    "a module whose system test starts fakes.temporal and fakes.nats and expects each of their ports between 10000 and 19999",
    async () => {
      const module = demoModule({
        bin: "process.stdout.write('demo');\n",
        steps: [
          "When the test starts fakes.temporal and fakes.nats",
          "Then each of their ports is between 10000 and 19999",
        ],
        test: [
          "let ports: number[] = [];",
          "await when('the test starts fakes.temporal and fakes.nats', async () => {",
          "  const temporal = await fakes.temporal();",
          "  const nats = await fakes.nats();",
          "  ports = [temporal.address, temporal.httpUrl, nats.url].map((url) => Number(url.split(':').at(-1)));",
          "});",
          "await then('each of their ports is between 10000 and 19999', async () => {",
          "  for (const port of ports) expect(port >= 10_000 && port <= 19_999, String(port)).toBe(true);",
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
