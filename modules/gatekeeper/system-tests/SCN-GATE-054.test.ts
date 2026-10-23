import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-054", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given(
    'the server asked "maintainers" for approval of the README request at "2026-01-01T00:00:00Z"',
    async () => {
      server = await askedServer(sut, fakes);
    },
  );

  await when('the server starts again at "2026-01-03T00:00:01Z"', async () => {
    await server.restart({ OSF_NOW: "2026-01-03T00:00:01Z" });
  });

  await then('"/v1/gates/<gate>" shows the state "expired" and a record with the decision "expired"', async () => {
    const gate = await server.gate(server.id);
    expect(gate?.state).toBe("expired");
    expect(gate?.record).toMatchObject({ decision: "expired", decidedAt: "2026-01-03T00:00:00.000001Z" });
    expect(gate?.record?.decidedBy).toBeUndefined();
  });

  await then('the thread has a reply that starts with "Expired at 2026-01-03T00:00:00.000001Z"', async () => {
    expect(replies(server.slack, server.message)).toEqual([
      expect.stringMatching(/^Expired at 2026-01-03T00:00:00\.000001Z without a decision\./),
    ]);
  });
});
