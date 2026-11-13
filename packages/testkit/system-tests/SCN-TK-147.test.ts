import { scenario } from "@opensoftware/testkit";
import { inferenceModule, testCases } from "./module.ts";

scenario("SCN-TK-147", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI starts a gateway with the adapter in "DEMO_INFERENCE_COMMAND", asks for a key for the run "run-7", revokes it, and prints the exit code and the error',
    async () => {
      module = inferenceModule(
        [
          'writeFileSync("litellm.yaml", "model_list: []\\n");',
          'const { id } = JSON.parse(inference("start", "litellm.yaml").stdout);',
          'inference("key", id, "run-7");',
          'const revoked = inference("revoke", id, "run-7");',
          "process.stdout.write(`${revoked.status} ${revoked.stderr}`);",
        ],
        ['expect(run.stdout, run.stderr).toBe("1 LiteLLM is down\\n");', "expect(inference.revoked()).toEqual([]);"],
        '{ revokeFails: "LiteLLM is down" }',
      );
    },
  );

  await given(
    'its system test starts fakes.inference whose revoke fails with "LiteLLM is down" and expects the exit code 1 and that message',
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
