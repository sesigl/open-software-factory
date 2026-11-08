import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

const COMPOSE = "services:\n  events:\n    image: nats:2.11.9-alpine\n";

/** A module whose one scenario runs `lines` with sut.compose on "compose.yaml". */
const moduleWith = (lines: string[]) =>
  demoModule({
    steps: ['When the test uses "compose.yaml"', "Then it went as planned"],
    test: [
      'const compose = sut.compose("compose.yaml");',
      "await when('the test uses \"compose.yaml\"', async () => {",
      '  const { readFileSync, writeFileSync } = await import("node:fs");',
      ...lines.map((line) => `  ${line}`),
      "});",
      'await then("it went as planned", async () => {});',
    ],
  });

scenario("SCN-TK-134", async ({ sut, given, when, then }) => {
  await given(
    'a module whose system test starts the service "events" of "compose.yaml" with sut.compose and then ends its process at once',
    async () => {
      const module = moduleWith([
        'await compose.run(["up", "--detach"]);',
        'const config = JSON.parse((await compose.run(["config", "--format", "json"])).stdout) as { name: string };',
        'writeFileSync(new URL("../left.txt", import.meta.url), config.name);',
        // Like a worker that is killed: no scenario end, so the project is not taken down.
        'process.kill(process.pid, "SIGKILL");',
      ]);
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
      await sut.files.put("$INPUT/compose.yaml", COMPOSE);
    },
  );

  await given(
    'the developer ran "testkit run --junit first.xml" in the module, which left the project of that scenario running',
    async () => {
      const first = await sut.cli(["run", "--junit", "first.xml"]);
      expect(first.exitCode, first.stdout + first.stderr).not.toBe(0);
      expect(await sut.files.read("$INPUT/left.txt")).toMatch(/^osf-sut-/);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" in the module with a system test that lists the Compose projects with sut.compose',
    async () => {
      const module = moduleWith([
        'const listed = await compose.run(["ls", "--all", "--format", "json"]);',
        'const names = (JSON.parse(listed.stdout || "[]") as { Name: string }[]).map(({ Name }) => Name);',
        'expect(names).not.toContain(readFileSync(new URL("../left.txt", import.meta.url), "utf8"));',
      ]);
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
      run = await sut.cli(["run", "--junit", "report.xml"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"report.xml" has the passed test case "SCN-DEMO-001", whose list does not hold the project of the first run',
    async () => {
      expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
        name: "SCN-DEMO-001",
        failed: false,
      });
    },
  );
});
