import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-105", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND" from a spec with the variable "CI" set to "true" and the secret "TOKEN" from "ref:file/token", and prints what "printenv CI TOKEN" prints in it',
    async () => {
      module = sandboxModule(
        [
          'const spec = { template: "node:24", env: { CI: "true" }, secrets: { TOKEN: "ref:file/token" } };',
          'writeFileSync("spec.json", JSON.stringify(spec));',
          'const id = sandbox("create", "spec.json").stdout.trim();',
          'process.stdout.write(sandbox("exec", id, "--", "printenv", "CI", "TOKEN").stdout);',
        ],
        [
          'expect(run.stdout, run.stderr).toBe("true\\nosf-secret-placeholder-TOKEN\\n");',
          "expect(sandbox.created()).toEqual([",
          '  { id: "000000000001", spec: { template: "node:24", env: { CI: "true" }, secrets: { TOKEN: "ref:file/token" } } },',
          "]);",
        ],
      );
    },
  );

  await given(
    'its system test expects "true" and "osf-secret-placeholder-TOKEN" and the spec the fake got',
    async () => {
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
