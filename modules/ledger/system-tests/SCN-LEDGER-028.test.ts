import { scenario } from "@opensoftware/testkit";
import { busyWeek } from "./records.ts";

scenario("SCN-LEDGER-028", async ({ sut, given, when, then }) => {
  await given("326 pull requests opened in the period and spend rows of 5351.38 USD in total", async () => {
    await sut.files.put("$INPUT/data.jsonl", busyWeek());
  });

  await when('the user runs "ledger report --markdown report.md data.jsonl"', async () => {
    const run = await sut.cli(["report", "--markdown", "report.md", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.md" has the row "| Cost per pull request | 16.42 USD |"', async () => {
    expect((await sut.files.read("$INPUT/report.md")).split("\n")).toContain("| Cost per pull request | 16.42 USD |");
  });

  await then('"report.md" has the sections "Throughput", "Cycle time", "Cost", "Spend" and "Revert rate"', async () => {
    const text = await sut.files.read("$INPUT/report.md");
    for (const section of ["Throughput", "Cycle time", "Cost", "Spend", "Revert rate"])
      expect(text.split("\n")).toContain(`## ${section}`);
  });
});
