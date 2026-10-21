import { scenario } from "@opensoftware/testkit";
import { traced } from "./repo.ts";

scenario("SCN-TRACE-058", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a file "summary.md" with the line "## Tests"', async () => {
    await sut.files.put("$INPUT/summary.md", "## Tests\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --summary summary.md"', async () => {
    run = await sut.cli(["report", "--summary", "summary.md"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the file "summary.md" in the working folder starts with "## Tests" and then contains "## spec-trace"',
    async () => {
      const summary = await sut.files.read("$INPUT/summary.md");
      expect(summary.startsWith("## Tests\n")).toBe(true);
      expect(summary.indexOf("## spec-trace")).toBeGreaterThan(0);
    },
  );
});
