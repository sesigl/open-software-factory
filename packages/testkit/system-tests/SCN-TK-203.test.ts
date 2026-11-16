import { scenario } from "@opensoftware/testkit";
import { outlineModule } from "./module.ts";

scenario("SCN-TK-203", async ({ sut, given, when, then }) => {
  await given(
    'a module whose planned Outline "SCN-DEMO-001" has the rows "alpha" and "beta" and a test that passes for both',
    async () => {
      const module = outlineModule(["| word |", "| alpha |", "| beta |"], "<word>", [], "planned");
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SCN-DEMO-001 is planned but its test passes: set @status=implemented."',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        "SCN-DEMO-001 is planned but its test passes: set @status=implemented.",
      );
    },
  );
});
