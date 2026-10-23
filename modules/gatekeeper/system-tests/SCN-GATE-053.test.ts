import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-053", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given(
    'the server asked "maintainers" for approval of the README request at "2026-01-01T00:00:00Z"',
    async () => {
      server = await askedServer(sut, fakes);
    },
  );

  await when('the server starts again at "2026-01-01T05:00:00Z"', async () => {
    await server.restart({ OSF_NOW: "2026-01-01T05:00:00Z" });
  });

  await then('the thread has a reply that asks "leads" after "4h" without a decision', async () => {
    expect(replies(server.slack, server.message)).toEqual([
      expect.stringMatching(
        /^No decision after 4h\. Approval needed from leads: Merge the new checkout flow\n.*\n\[gatekeeper g[0-9a-f]{16} escalated\]$/,
      ),
    ]);
  });

  await then('"/v1/gates/<gate>" shows the state "pending" that waits for "leads" and "maintainers"', async () => {
    const gate = await server.gate(server.id);
    expect(gate?.state).toBe("pending");
    expect([...(gate?.waitingFor ?? [])].sort()).toEqual(["leads", "maintainers"]);
  });
});
