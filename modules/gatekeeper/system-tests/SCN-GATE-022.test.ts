import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-022", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given(
    'the approval request of the README request, made with the Slack time "1767225600.000001" and "expire_after" "2d"',
    async () => {
      setup = await requested(sut, fakes);
      expect(setup.message.ts).toBe("1767225600.000001");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments at "2026-01-03T01:00:00Z"', async () => {
    run = await sut.cli(["status", ...GATE], { env: { ...setup.env, OSF_NOW: "2026-01-03T01:00:00Z" } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
  });

  await then(
    '"$OUTPUT/record.json" has the decision "expired" at "2026-01-03T00:00:00.000001Z" and no person',
    async () => {
      const record = JSON.parse(await sut.files.read("$OUTPUT/record.json"));
      expect(record).toMatchObject({ decision: "expired", decidedAt: "2026-01-03T00:00:00.000001Z" });
      expect(record).not.toHaveProperty("decidedBy");
    },
  );

  await then('the thread has the reply "Expired"', async () => {
    expect(replies(setup.slack, setup.message)).toEqual([
      expect.stringMatching(/^Expired at 2026-01-03T00:00:00\.000001Z without a decision\./),
    ]);
  });
});
