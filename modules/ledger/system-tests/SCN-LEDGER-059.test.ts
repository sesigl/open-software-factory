import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened } from "./records.ts";

scenario("SCN-LEDGER-059", async ({ sut, given, when, then }) => {
  await given("2 pull requests opened on 2026-01-05 and one of them merged on 2026-01-05", async () => {
    await sut.files.put("$INPUT/data.jsonl", lines(opened(1), opened(2), closed(1, "2026-01-05T12:00:00Z")));
  });

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"ledger.html" has a bar for "2026-01-05: 2 opened, 1 merged"', async () => {
    const html = await sut.files.read("$INPUT/ledger.html");
    expect(html).toMatch(/<rect [^>]*height="[1-9][\d.]*"[^>]*><title>2026-01-05: 2 opened, 1 merged<\/title><\/rect>/);
  });
});
