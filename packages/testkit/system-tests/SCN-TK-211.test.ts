import { scenario } from "@opensoftware/testkit";
import { composeCalls, composePlugin, groupModule, sharedCompose, testCases } from "./module.ts";

/** The text of the failure of the test case `name` in a JUnit report, with its XML entities read. */
const failureOf = (report: string, name: string): string =>
  (new RegExp(`<testcase [^>]*name="${name}"[^>]*>([\\s\\S]*?)</testcase>`).exec(report)?.[1] ?? "")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");

scenario("SCN-TK-211", async ({ sut, given, when, then }) => {
  const log = sut.files.path("$INPUT/compose.log");
  await given(
    'a Docker configuration folder whose plugin "cli-plugins/docker-compose" writes each call to "compose.log" and fails "up" with "no such image"',
    async () => {
      const plugin = composePlugin(log, "no such image");
      await sut.files.put("$INPUT/docker/cli-plugins/docker-compose", plugin, { executable: true });
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
    'each test runs "up" with sut.compose in the shared start "profile" and fails the start when "up" fails',
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

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('"report.xml" has the failed test cases "SCN-DEMO-001" and "SCN-DEMO-002"', async () => {
    const cases = testCases(await sut.files.read("$INPUT/report.xml"));
    expect(cases).toContainEqual({ name: "SCN-DEMO-001", failed: true });
    expect(cases).toContainEqual({ name: "SCN-DEMO-002", failed: true });
  });

  await then(
    'the failure of each of the two test cases says \'the shared start "profile" failed\' with "no such image"',
    async () => {
      const report = await sut.files.read("$INPUT/report.xml");
      for (const name of ["SCN-DEMO-001", "SCN-DEMO-002"]) {
        expect(failureOf(report, name), name).toMatch(/the shared start "profile" failed[^\n]*no such image/);
      }
    },
  );

  await then('"compose.log" has one "up", and after it one "down" of its project', async () => {
    const calls = composeCalls(await sut.files.read("$INPUT/compose.log"));
    const up = calls.filter((call) => call.command === "up");
    expect(up).toHaveLength(1);
    expect(calls.filter((call) => call.command === "down")).toEqual([{ project: up[0]?.project, command: "down" }]);
    expect(calls.at(-1)?.command).toBe("down");
  });
});
