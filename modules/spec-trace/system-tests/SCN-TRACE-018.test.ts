import { scenario } from "@opensoftware/testkit";
import { block, feature, put, test } from "./repo.ts";

scenario("SCN-TRACE-018", async ({ sut, given, when, then }) => {
  await given(
    'a port "forge" with the implemented @conformance scenario "SCN-FORGE-001" and the adapters "a" and "b"',
    async () => {
      await put(sut, {
        "ports/forge/features/checkout.feature": feature(block("@id=SCN-FORGE-001 @status=implemented @conformance")),
        "adapters/forge/a/src/index.ts": "export {};\n",
        "adapters/forge/b/src/index.ts": "export {};\n",
      });
    },
  );

  await given('only the adapter "a" has a test for "SCN-FORGE-001"', async () => {
    await sut.files.put("$INPUT/adapters/forge/a/tests/SCN-FORGE-001.test.ts", test("SCN-FORGE-001"));
  });

  await given(
    'a spec-trace.json with the conformance tag "@conformance" for "ports/{port}/features/" and "adapters/{port}/{adapter}/"',
    async () => {
      await sut.files.put(
        "$INPUT/spec-trace.json",
        JSON.stringify({
          conformance: { tag: "@conformance", ports: "ports/{port}/features/", adapters: "adapters/{port}/{adapter}/" },
        }),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE ports/forge/features/checkout.feature:4 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/, has 0"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE ports/forge/features/checkout.feature:4 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/, has 0",
      );
    },
  );
});
