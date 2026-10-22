import { scenario } from "@opensoftware/testkit";
import { signedRecord } from "./record.ts";

scenario("SCN-GATE-028", async ({ sut, fakes, given, when, then }) => {
  await given('a record that "gatekeeper status" wrote without "GATEKEEPER_SIGNING_KEY"', async () => {
    const status = await signedRecord(sut, fakes, false);
    expect(status.stderr).toContain("the record is not signed: set GATEKEEPER_SIGNING_KEY");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper verify --public-key gatekeeper.pub record.json"', async () => {
    run = await sut.cli(["verify", "--public-key", "gatekeeper.pub", "record.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says "the record has no signature"', async () => {
    expect(run.stderr).toBe("gatekeeper: record.json: the record has no signature\n");
  });
});
