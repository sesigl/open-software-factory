import { scenario } from "@osf/testkit";

scenario("SCN-CTR-003", async ({ sut, fakes, given, when, then }) => {
  await given('a run record "run.json" with a transcript URI, two artifact URIs and a pull request URL', async () => {
    const record = JSON.parse(fakes.fixture("run.json"));
    expect(record.span["osf.transcript.uri"]).toBeDefined();
    expect(record.span["osf.artifact.uris"]).toHaveLength(2);
    expect(record.span["osf.pull_request.urls"]).toHaveLength(1);
    await sut.files.put("run.json", fakes.fixture("run.json"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate run-record run.json"', async () => {
    run = await sut.cli(["validate", "run-record", "run.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "run.json: valid run-record"', async () => {
    expect(run.stdout).toContain("run.json: valid run-record");
  });
});
