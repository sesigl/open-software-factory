import { scenario } from "@opensoftware/testkit";
import { readReport } from "./repo.ts";

scenario("SCN-TRACE-001", async ({ sut, fakes, given, when, then }) => {
  await given("the feature file and the test from the README", async () => {
    const readme = fakes.fromRepository("modules/spec-trace")["README.md"] as string;
    for (const path of ["features/checkout.feature", "tests/SCN-SHOP-001.test.ts"]) {
      const block = new RegExp(`^\`\`\`\\w+ ${path.replaceAll(".", "\\.")}\\n([\\s\\S]*?)^\`\`\`$`, "m").exec(
        readme,
      )?.[1];
      if (!block) throw new Error(`the README has no code block for ${path}`);
      await sut.files.put(`$INPUT/${path}`, block);
    }
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs());
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });

  await then(
    'the report lists "SCN-SHOP-001" as "implemented" with the test "tests/SCN-SHOP-001.test.ts:3"',
    async () => {
      const report = await readReport(sut);
      expect(report.scenarios).toMatchObject([
        { id: "SCN-SHOP-001", status: "implemented", tests: ["tests/SCN-SHOP-001.test.ts:3"] },
      ]);
      expect(report.findings).toEqual([]);
    },
  );
});
