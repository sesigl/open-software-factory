import { scenario } from "@opensoftware/testkit";
import { signedRecord } from "./record.ts";

scenario("SCN-GATE-026", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a record that "gatekeeper status" wrote with the key of "gatekeeper keys" in "GATEKEEPER_SIGNING_KEY"',
    async () => {
      await signedRecord(sut, fakes, true);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper verify --public-key gatekeeper.pub record.json"', async () => {
    run = await sut.cli(["verify", "--public-key", "gatekeeper.pub", "record.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "verified: approved by slack:U0ADA"', async () => {
    expect(run.stdout).toBe("record.json verified: approved by slack:U0ADA at 2026-01-01T00:00:00.000002Z\n");
  });
});
