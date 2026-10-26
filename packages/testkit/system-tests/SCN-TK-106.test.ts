import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-106", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI copies the folder "work" into a sandbox of the adapter in "DEMO_SANDBOX_COMMAND", appends "done" to "work/notes.md" in it, and copies "work" out to "result"',
    async () => {
      module = sandboxModule(
        [
          'mkdirSync("work");',
          'writeFileSync("work/notes.md", "draft\\n");',
          'writeFileSync("spec.json", JSON.stringify({ template: "node:24" }));',
          'const id = sandbox("create", "spec.json").stdout.trim();',
          'sandbox("copy", "work", `${id}:work`);',
          'sandbox("exec", id, "--", "sh", "-c", "echo done >> work/notes.md");',
          'sandbox("copy", `${id}:/workspace/work`, "result");',
        ],
        [
          'expect(await sut.files.read("$INPUT/result/notes.md"), run.stderr).toBe("draft\\ndone\\n");',
          "expect(sandbox.execs()).toEqual([",
          '  { id: "000000000001", command: ["sh", "-c", "echo done >> work/notes.md"], files: ["work", "work/notes.md"] },',
          "]);",
        ],
      );
    },
  );

  await given(
    'its system test expects "result/notes.md" to say "draft" and "done", and the fake to show "notes.md" in the folder when the command started',
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
