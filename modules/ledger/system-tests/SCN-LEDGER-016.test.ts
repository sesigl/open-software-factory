import { scenario } from "@opensoftware/testkit";
import { lines, opened, prUrl, readReport, runLine } from "./records.ts";

scenario("SCN-LEDGER-016", async ({ sut, given, when, then }) => {
  await given("25 pull requests whose runs cost 1 USD to 25 USD", async () => {
    const numbers = Array.from({ length: 25 }, (_, index) => index + 1);
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        ...numbers.map((number) => opened(number)),
        ...numbers.map((number) => runLine(`run-${number}`, { cost: number, pullRequests: [prUrl(number)] })),
      ),
    );
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then(
    '"report.json" lists 20 pull requests by cost, from 25.00 USD down to 6.00 USD, each with its URL and title',
    async () => {
      const top = (await readReport(sut)).topPullRequests;
      expect(top).toHaveLength(20);
      expect(top[0]).toEqual({ url: prUrl(25), title: "Change 25", usd: 25 });
      expect(top[19]).toEqual({ url: prUrl(6), title: "Change 6", usd: 6 });
      expect(top.map((pr: { usd: number }) => pr.usd)).toEqual(Array.from({ length: 20 }, (_, index) => 25 - index));
    },
  );
});
