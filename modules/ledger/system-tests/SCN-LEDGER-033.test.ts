import { scenario } from "@opensoftware/testkit";
import { readmeSample } from "./postgres.ts";

scenario("SCN-LEDGER-033", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given("the sample file from the README ingested into a PostgreSQL database", async () => {
    url = (await fakes.postgres()).url;
    await sut.files.put("$INPUT/ledger.jsonl", readmeSample(fakes));
    const run = await sut.cli(["ingest", "--db", url, "ledger.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "ledger query --db <database URL> SELECT url, inference_usd FROM pr_cost ORDER BY url"',
    async () => {
      run = await sut.cli(["query", "--db", url, "SELECT url, inference_usd FROM pr_cost ORDER BY url"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output has the line {"url":"https://github.com/acme/web/pull/1","inference_usd":2.5}', async () => {
    expect(run.stdout.split("\n")).toContain('{"url":"https://github.com/acme/web/pull/1","inference_usd":2.5}');
  });

  await then('the output has the line {"url":"https://github.com/acme/web/pull/2","inference_usd":1}', async () => {
    expect(run.stdout.split("\n")).toContain('{"url":"https://github.com/acme/web/pull/2","inference_usd":1}');
  });
});
