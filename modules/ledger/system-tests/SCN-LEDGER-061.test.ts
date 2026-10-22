import { scenario } from "@opensoftware/testkit";
import { lines, opened, prUrl, runLine } from "./records.ts";

scenario("SCN-LEDGER-061", async ({ sut, given, when, then }) => {
  await given(
    'the pull request "https://github.com/acme/web/pull/1" titled "<script>alert(1)</script>" whose run cost 1 USD',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          opened(1, { title: "<script>alert(1)</script>" }),
          runLine("run-01", { cost: 1, pullRequests: [prUrl(1)] }),
        ),
      );
    },
  );

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"ledger.html" contains "&lt;script&gt;alert(1)&lt;/script&gt;"', async () => {
    expect(await sut.files.read("$INPUT/ledger.html")).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  await then('"ledger.html" has no "<script" element', async () => {
    expect(await sut.files.read("$INPUT/ledger.html")).not.toContain("<script");
  });
});
