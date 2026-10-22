import { scenario } from "@opensoftware/testkit";
import { lines, opened, pageText, prUrl, runLine } from "./records.ts";

scenario("SCN-LEDGER-060", async ({ sut, given, when, then }) => {
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

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"ledger.html" links "https://github.com/acme/web/pull/25" with the text "Change 25" and shows "25.00 USD"',
    async () => {
      const html = await sut.files.read("$INPUT/ledger.html");
      expect(html).toContain(`<a href="${prUrl(25)}">Change 25</a>`);
      expect(await pageText(sut)).toContain("Change 25 25.00 USD");
    },
  );

  await then('"ledger.html" links 20 pull requests', async () => {
    const html = await sut.files.read("$INPUT/ledger.html");
    expect(html.match(/<a href="https:\/\/github\.com\/acme\/web\/pull\/\d+">/g)).toHaveLength(20);
  });
});
