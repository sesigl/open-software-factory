import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-047", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server, with a signing key, asked "maintainers" for approval of the README request', async () => {
    const keys = await sut.cli(["keys", "--out", "."]);
    expect(keys.exitCode, keys.stderr).toBe(0);
    server = await askedServer(sut, fakes, {
      env: { GATEKEEPER_SIGNING_KEY: await sut.files.read("$INPUT/gatekeeper.pem") },
    });
  });

  await when('"slack:U0ADA" of "maintainers" presses "Approve" on the request', async () => {
    await server.slack.press({
      channel: "C0GATES",
      ts: server.message.ts,
      actionId: "gatekeeper.approve",
      user: "U0ADA",
    });
  });

  let gate: Awaited<ReturnType<typeof server.gate>>;
  await then(
    '"/v1/gates/<gate>" shows the state "approved" and a record approved by the person "slack:U0ADA"',
    async () => {
      gate = await server.gate(server.id);
      expect(gate).toMatchObject({ id: server.id, state: "approved" });
      expect(gate?.record).toMatchObject({
        gate: server.id,
        decision: "approved",
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        decidedAt: "2026-01-01T00:00:00.000002Z",
        signature: { algorithm: "Ed25519" },
      });
    },
  );

  await then('the record verifies with "gatekeeper verify" and the public key', async () => {
    await sut.files.put("$INPUT/record.json", JSON.stringify(gate?.record));
    const run = await sut.cli(["verify", "--public-key", "gatekeeper.pub", "record.json"]);
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe("record.json verified: approved by slack:U0ADA at 2026-01-01T00:00:00.000002Z\n");
  });

  await then('the thread has the reply "Approved by <@U0ADA>."', async () => {
    expect(replies(server.slack, server.message)).toEqual([
      expect.stringMatching(/^Approved by <@U0ADA>\.\n\[gatekeeper g[0-9a-f]{16} decided\]$/),
    ]);
  });
});
