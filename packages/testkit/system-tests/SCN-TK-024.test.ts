import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-024", async ({ sut, given, when, then }) => {
  await given('a module whose package.json bin is "src/demo.js"', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
    const manifest = { name: "demo", version: "0.1.0", type: "module", bin: { demo: "src/demo.js" } };
    await sut.files.put("$INPUT/package.json", `${JSON.stringify(manifest, null, 2)}\n`);
    await sut.files.put("$INPUT/src/demo.js", 'process.stdout.write("hello\\n");\n');
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "BOUNDARY-RUNTIME: package.json starts src/demo.js; point bin at the built artifact"',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        "BOUNDARY-RUNTIME: package.json starts src/demo.js; point bin at the built artifact",
      );
    },
  );
});
