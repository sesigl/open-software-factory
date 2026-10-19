import { scenario } from "@opensoftware/testkit";
import { DEMO_PACKAGE, feature, prefixes, scenarioText, systemTest } from "./repo.ts";

scenario("SCN-REPO-030", async ({ sut, given, when, then }) => {
  await given(
    'a port "forge" with the implemented @conformance scenario "SCN-FORGE-001" and the adapters "a" and "b"',
    async () => {
      await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["FORGE", "ports/forge/features/"]));
      const text = scenarioText("SCN-FORGE-001", "implemented").replace("@status=implemented", "$& @conformance");
      await sut.files.put("$INPUT/ports/forge/features/a.feature", feature(text));
      await sut.files.put("$INPUT/adapters/forge/a/package.json", DEMO_PACKAGE);
      await sut.files.put("$INPUT/adapters/forge/b/package.json", DEMO_PACKAGE);
    },
  );

  await given('only the adapter "a" has a system test for "SCN-FORGE-001"', async () => {
    const test = systemTest().replace("SCN-DEMO-001", "SCN-FORGE-001");
    await sut.files.put("$INPUT/adapters/forge/a/system-tests/SCN-FORGE-001.test.ts", test);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TRACE"', async () => {
    run = await sut.cli(["check", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE ports/forge/features/a.feature:5 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/system-tests/, has 0"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE ports/forge/features/a.feature:5 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/system-tests/, has 0",
      );
    },
  );
});
