import { scenario } from "@osf/testkit";

scenario("SCN-CTR-004", async ({ sut, fakes, given, when, then }) => {
  await given('a run record "run.json" without the attribute "osf.requester.id"', async () => {
    const record = JSON.parse(fakes.fixture("run.json"));
    delete record.resource["osf.requester.id"];
    await sut.files.put("run.json", JSON.stringify(record, null, 2));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate run-record run.json"', async () => {
    run = await sut.cli(["validate", "run-record", "run.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "run.json /resource/osf.requester.id: missing required field"', async () => {
    expect(run.stdout).toContain("run.json /resource/osf.requester.id: missing required field");
  });
});
