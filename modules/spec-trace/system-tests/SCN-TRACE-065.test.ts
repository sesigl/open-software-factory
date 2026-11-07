import { scenario } from "@opensoftware/testkit";
import { baseCommit } from "./repo.ts";

scenario("SCN-TRACE-065", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --summary summary.md --base" with the base commit', async () => {
    run = await sut.cli(["report", "--summary", "summary.md", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the file "summary.md" in the working folder has the lines "## spec-trace", "", "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 1 with a test, 0 passed", "", "### Changes since `<base>`", "", "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps.", "", "### Findings", "", "No findings.", ""',
    async () => {
      expect((await sut.files.read("$INPUT/summary.md")).split("\n")).toEqual([
        "## spec-trace",
        "",
        "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 1 with a test, 0 passed",
        "",
        `### Changes since \`${base}\``,
        "",
        "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps.",
        "",
        "### Findings",
        "",
        "No findings.",
        "",
      ]);
    },
  );
});
