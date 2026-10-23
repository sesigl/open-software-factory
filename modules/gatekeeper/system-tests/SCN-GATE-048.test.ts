import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-048", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked "maintainers" for approval of the README request', async () => {
    server = await askedServer(sut, fakes);
  });

  await when('"slack:U0ADA" of "maintainers" replies "reject Needs a security review" in the thread', async () => {
    await server.slack.say({
      channel: "C0GATES",
      text: "reject Needs a security review",
      user: "U0ADA",
      threadTs: server.message.ts,
    });
  });

  await then(
    '"/v1/gates/<gate>" shows the state "rejected" and a record with the reason "Needs a security review"',
    async () => {
      const gate = await server.gate(server.id);
      expect(gate?.state).toBe("rejected");
      expect(gate?.record).toMatchObject({
        decision: "rejected",
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        reason: "Needs a security review",
      });
    },
  );

  await then('the thread has the reply "Rejected by <@U0ADA>: Needs a security review."', async () => {
    expect(replies(server.slack, server.message)).toEqual([
      "reject Needs a security review",
      expect.stringMatching(/^Rejected by <@U0ADA>: Needs a security review\.\n\[gatekeeper g[0-9a-f]{16} decided\]$/),
    ]);
  });
});
