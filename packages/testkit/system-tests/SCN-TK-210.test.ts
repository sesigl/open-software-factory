import { scenario } from "@opensoftware/testkit";
import { composeCalls, composePlugin, groupModule, sharedCompose, testCases } from "./module.ts";

scenario("SCN-TK-210", async ({ sut, given, when, then }) => {
  const log = sut.files.path("$INPUT/compose.log");
  await given(
    'a Docker configuration folder whose plugin "cli-plugins/docker-compose" writes each call to "compose.log"',
    async () => {
      await sut.files.put("$INPUT/docker/cli-plugins/docker-compose", composePlugin(log), { executable: true });
    },
  );

  await given(
    'a module whose scenarios "SCN-DEMO-001" and "SCN-DEMO-002" carry the tag "@shared=profile", each with a test file of its own',
    async () => {
      for (const [path, content] of Object.entries(groupModule([sharedCompose, sharedCompose]))) {
        await sut.files.put(path, content);
      }
    },
  );

  await given(
    'each test runs "up" with sut.compose in the shared start "profile" and then "ps" on the shared project',
    async () => {
      // Both test files are sharedCompose's; this is the Compose file they run.
      await sut.files.put("$INPUT/compose.yaml", "services:\n  events:\n    image: nats:2.11.9-alpine\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" in the module with "DOCKER_CONFIG" set to that folder',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], {
        env: { DOCKER_CONFIG: sut.files.path("$INPUT/docker") },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"', async () => {
    const cases = testCases(await sut.files.read("$INPUT/report.xml"));
    expect(cases).toContainEqual({ name: "SCN-DEMO-001", failed: false });
    expect(cases).toContainEqual({ name: "SCN-DEMO-002", failed: false });
  });

  await then(
    '"compose.log" has one "up" and two "ps" of one project, and after them one "down" of that project',
    async () => {
      const calls = composeCalls(await sut.files.read("$INPUT/compose.log"));
      const projects = [...new Set(calls.map((call) => call.project))];
      expect(projects).toHaveLength(1);
      expect(projects[0]).toMatch(/^osf-sut-/);
      const commands = calls.map((call) => call.command);
      expect(commands.filter((command) => command === "up")).toHaveLength(1);
      expect(commands.filter((command) => command === "ps")).toHaveLength(2);
      expect(commands.filter((command) => command === "down")).toHaveLength(1);
      expect(commands.at(-1)).toBe("down");
    },
  );
});
