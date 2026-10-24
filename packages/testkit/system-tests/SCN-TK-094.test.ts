import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-094", async ({ sut, given, when, then }) => {
  await given('a module whose system test calls sut.adapter("demo/missing")', async () => {
    const module = demoModule({
      steps: ['When the user runs "demo"'],
      test: ["await when('the user runs \"demo\"', async () => {", '  sut.adapter("demo/missing");', "});"],
    });
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "no adapter adapters/demo/missing above"', async () => {
    expect(run.stdout + run.stderr).toContain("no adapter adapters/demo/missing above");
  });
});
