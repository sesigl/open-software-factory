import { scenario } from "@opensoftware/testkit";
import { signedRecord } from "./record.ts";

scenario("SCN-GATE-027", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a record that "gatekeeper status" wrote with the key of "gatekeeper keys" in "GATEKEEPER_SIGNING_KEY"',
    async () => {
      await signedRecord(sut, fakes, true);
    },
  );

  await given('its "decidedBy" changed to "slack:U0EVE"', async () => {
    const record = JSON.parse(await sut.files.read("$INPUT/record.json"));
    expect(record.signature).toMatchObject({ algorithm: "Ed25519", key: expect.stringMatching(/^sha256:/) });
    record.decidedBy.id = "slack:U0EVE";
    await sut.files.put("$INPUT/record.json", JSON.stringify(record));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper verify --public-key gatekeeper.pub record.json"', async () => {
    run = await sut.cli(["verify", "--public-key", "gatekeeper.pub", "record.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says "the signature does not match"', async () => {
    expect(run.stderr).toBe("gatekeeper: record.json: the signature does not match\n");
  });
});
