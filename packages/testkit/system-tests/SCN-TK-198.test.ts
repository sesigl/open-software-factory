import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-198", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND", copies the folder "work" in and out again, and prints whether the create and the copy out each took at least 300 milliseconds',
    async () => {
      module = sandboxModule(
        [
          'mkdirSync("work");',
          'writeFileSync("work/notes.md", "draft\\n");',
          'writeFileSync("spec.json", JSON.stringify({ template: "node:24" }));',
          "const took = (step) => { const start = Date.now(); const result = step(); return [result, Date.now() - start]; };",
          'const [created, create] = took(() => sandbox("create", "spec.json"));',
          "const id = created.stdout.trim();",
          'sandbox("copy", "work", `${id}:work`);',
          'const [, out] = took(() => sandbox("copy", `${id}:work`, "result"));',
          'const slow = (ms) => (ms >= 300 ? "slow" : "fast");',
          "process.stdout.write(`create ${slow(create)}, copy out ${slow(out)}\\n`);",
        ],
        ['expect(run.stdout, run.stderr).toBe("create slow, copy out slow\\n");'],
        "{ takesMs: { create: 300, copyOut: 300 } }",
      );
    },
  );

  await given(
    'its system test starts fakes.sandbox with "takesMs" of 300 for "create" and "copyOut" and expects "create slow, copy out slow"',
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
