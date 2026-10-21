import { scenario } from "@opensoftware/testkit";
import { readReport } from "./records.ts";

scenario("SCN-LEDGER-001", async ({ sut, fakes, given, when, then }) => {
  await given("the sample file from the README", async () => {
    const readme = fakes.fromRepository("modules/ledger")["README.md"] as string;
    const block = /^```jsonl ledger\.jsonl\n([\s\S]*?)^```$/m.exec(readme)?.[1];
    if (!block) throw new Error("the README has no code block for ledger.jsonl");
    await sut.files.put("$INPUT/ledger.jsonl", block);
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

  await then('"report.json" shows 2 pull requests and a cost per pull request of 1.75 USD', async () => {
    const report = await readReport(sut);
    expect(report.pullRequests.opened).toBe(2);
    expect(report.costPerPullRequest.usd).toBe(1.75);
  });
});
