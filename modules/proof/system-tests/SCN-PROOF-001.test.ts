import { scenario } from "@opensoftware/testkit";
import { manifestOf } from "./reports.ts";

scenario("SCN-PROOF-001", async ({ sut, fakes, given, when, then }) => {
  await given("a Git repository with one commit, the Playwright report from the README and its trace", async () => {
    const readme = fakes.fromRepository("modules/proof")["README.md"] as string;
    const report = /^```json report\.json\n([\s\S]*?)^```$/m.exec(readme)?.[1];
    if (!report) throw new Error("the README has no ```json report.json block");
    await sut.files.put("$INPUT/report.json", report);
    await sut.files.put("$INPUT/test-results/checkout/trace.zip", "PK trace");
    await sut.git.commit("init");
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
    'the bundle lists "artifacts/SCN-WEB-001/trace.zip" as "playwright-trace" for the scenario "SCN-WEB-001"',
    async () => {
      const manifest = await manifestOf(sut);
      expect(manifest.scenarios).toEqual([
        { id: "SCN-WEB-001", result: "passed", artifacts: ["artifacts/SCN-WEB-001/trace.zip"] },
      ]);
      expect(manifest.artifacts[0]).toMatchObject({
        path: "artifacts/SCN-WEB-001/trace.zip",
        kind: "playwright-trace",
      });
    },
  );
});
