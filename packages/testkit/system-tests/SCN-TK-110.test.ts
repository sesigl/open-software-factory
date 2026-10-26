import { scenario } from "@opensoftware/testkit";
import { inferenceModule, testCases } from "./module.ts";

scenario("SCN-TK-110", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI writes "model_list: []" to "litellm.yaml", starts a gateway from it with the adapter in "DEMO_INFERENCE_COMMAND", and prints what start printed and the list',
    async () => {
      module = inferenceModule(
        [
          'writeFileSync("litellm.yaml", "model_list: []\\n");',
          'process.stdout.write(inference("start", "litellm.yaml").stdout);',
          'process.stdout.write(inference("list").stdout);',
        ],
        [
          "expect(run.stdout, run.stderr).toBe(",
          '  `${JSON.stringify({ id: "000000000001", url: "http://127.0.0.1:4100/v1" })}\\n000000000001\\n`,',
          ");",
          'expect(inference.started()).toEqual([{ id: "000000000001", config: "model_list: []\\n" }]);',
          'expect(inference.list()).toEqual(["000000000001"]);',
        ],
        '{ url: "http://127.0.0.1:4100/v1" }',
      );
    },
  );

  await given(
    'its system test starts fakes.inference with the URL "http://127.0.0.1:4100/v1" and expects the ID "000000000001", that URL, the list "000000000001" and the config "model_list: []"',
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
