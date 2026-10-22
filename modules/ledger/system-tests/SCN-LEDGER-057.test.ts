import { scenario } from "@opensoftware/testkit";
import { lines, opened, pageText, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-057", async ({ sut, given, when, then }) => {
  await given("2 pull requests, spend rows of 10.00 USD in total and runs of 4 hours in total", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        opened(1),
        opened(2),
        runLine("run-01", { hours: 1.5 }),
        runLine("run-02", { hours: 2.5 }),
        spendRow("req-1", 6, { run: "run-01" }),
        spendRow("req-2", 4, { run: "run-02" }),
      ),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "ledger report --compute-usd-per-hour 0.50 --platform-usd 6 --html ledger.html data.jsonl"',
    async () => {
      const options = ["--compute-usd-per-hour", "0.50", "--platform-usd", "6", "--html", "ledger.html"];
      run = await sut.cli(["report", ...options, "data.jsonl"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "wrote" and the path of "ledger.html"', async () => {
    expect(run.stdout).toMatch(/^wrote .*ledger\.html$/m);
  });

  await then('"ledger.html" shows "Cost per pull request 9.00 USD"', async () => {
    expect(await pageText(sut)).toContain("Cost per pull request 9.00 USD");
  });

  await then('"ledger.html" shows "Inference 5.00 USD", "Compute 1.00 USD" and "Platform 3.00 USD"', async () => {
    const text = await pageText(sut);
    for (const shown of ["Inference 5.00 USD", "Compute 1.00 USD", "Platform 3.00 USD"]) expect(text).toContain(shown);
  });
});
