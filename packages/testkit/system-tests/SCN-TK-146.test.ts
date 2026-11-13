import { scenario } from "@opensoftware/testkit";
import { inferenceModule, testCases } from "./module.ts";

scenario("SCN-TK-146", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI starts a gateway with the adapter in "DEMO_INFERENCE_COMMAND", asks for a key for the run "run-7" twice, revokes the run\'s key twice, and prints the keys and the exit codes',
    async () => {
      module = inferenceModule(
        [
          'writeFileSync("litellm.yaml", "model_list: []\\n");',
          'const { id } = JSON.parse(inference("start", "litellm.yaml").stdout);',
          'process.stdout.write(inference("key", id, "run-7", "--budget", "5").stdout);',
          'process.stdout.write(inference("key", id, "run-7", "--budget", "5").stdout);',
          'process.stdout.write(`${inference("revoke", id, "run-7").status} ${inference("revoke", id, "run-7").status}`);',
        ],
        [
          'expect(run.stdout, run.stderr).toBe("sk-fake-1\\nsk-fake-1\\n0 0");',
          "expect(inference.keys()).toEqual([",
          '  { key: "sk-fake-1", gateway: "000000000001", run: "run-7", budget: "5" },',
          "]);",
          "expect(inference.revoked()).toEqual([",
          '  { gateway: "000000000001", run: "run-7" },',
          '  { gateway: "000000000001", run: "run-7" },',
          "]);",
        ],
      );
    },
  );

  await given(
    'its system test expects the key "sk-fake-1" twice, exit codes 0, the one key the fake recorded and the two revokes of "run-7" it recorded',
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
