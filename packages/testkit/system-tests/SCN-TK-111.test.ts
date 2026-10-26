import { scenario } from "@opensoftware/testkit";
import { inferenceModule, testCases } from "./module.ts";

scenario("SCN-TK-111", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI starts a gateway with the adapter in "DEMO_INFERENCE_COMMAND", asks for a key for the run "run-7" with the budget "5" and one for "run-8" without a budget, stops the gateway, and prints the keys and the list',
    async () => {
      module = inferenceModule(
        [
          'writeFileSync("litellm.yaml", "model_list: []\\n");',
          'const { id } = JSON.parse(inference("start", "litellm.yaml").stdout);',
          'process.stdout.write(inference("key", id, "run-7", "--budget", "5").stdout);',
          'process.stdout.write(inference("key", id, "run-8").stdout);',
          'inference("stop", id);',
          'process.stdout.write(`list: ${inference("list").stdout}`);',
        ],
        [
          'expect(run.stdout, run.stderr).toBe("sk-fake-1\\nsk-fake-2\\nlist: ");',
          "expect(inference.keys()).toEqual([",
          '  { key: "sk-fake-1", gateway: "000000000001", run: "run-7", budget: "5" },',
          '  { key: "sk-fake-2", gateway: "000000000001", run: "run-8" },',
          "]);",
          "expect(inference.list()).toEqual([]);",
        ],
      );
    },
  );

  await given(
    'its system test expects the keys "sk-fake-1" and "sk-fake-2", the runs and the budget the fake recorded, and an empty list',
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
