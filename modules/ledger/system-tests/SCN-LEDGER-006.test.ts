import { scenario } from "@opensoftware/testkit";
import { readReport, spendRow } from "./records.ts";

scenario("SCN-LEDGER-006", async ({ sut, given, when, then }) => {
  await given(
    'the file "spend.json" with the JSON array LiteLLM\'s "GET /spend/logs" returns, with 2 rows of 0.40 USD and 0.60 USD',
    async () => {
      const rows = [spendRow("req-1", 0.4), spendRow("req-2", 0.6)];
      await sut.files.put("$INPUT/spend.json", JSON.stringify(rows, null, 2));
    },
  );

  await when('the user runs "ledger report spend.json"', async () => {
    expect((await sut.cli(["report", "spend.json"])).exitCode).toBe(0);
  });

  await then('"report.json" shows a total spend of 1.00 USD', async () => {
    expect((await readReport(sut)).spend.total).toBe(1);
  });
});
