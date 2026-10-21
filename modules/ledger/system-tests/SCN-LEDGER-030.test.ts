import { scenario } from "@opensoftware/testkit";
import { readmeSample } from "./postgres.ts";

scenario("SCN-LEDGER-030", async ({ sut, fakes, given, when, then }) => {
  await given("the sample file from the README", async () => {
    await sut.files.put("$INPUT/ledger.jsonl", readmeSample(fakes));
  });

  let url = "";
  await given('a PostgreSQL database with the user "test" and the password "test"', async () => {
    url = (await fakes.postgres()).url;
    expect(url).toMatch(/^postgres:\/\/test:test@/);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest ledger.jsonl" with "LEDGER_DB" set to the database\'s URL', async () => {
    run = await sut.cli(["ingest", "ledger.jsonl"], { env: { LEDGER_DB: url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output says "ingested 2 runs, 2 spend rows and 3 events into postgres://test:***@"', async () => {
    expect(run.stdout).toContain("ingested 2 runs, 2 spend rows and 3 events into postgres://test:***@");
    expect(run.stdout + run.stderr).not.toContain("test:test@");
  });
});
