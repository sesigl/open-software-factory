import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-049", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked "maintainers" for approval of the README request', async () => {
    server = await askedServer(sut, fakes);
  });

  await when('"slack:U0BEN" of "reviewers" presses "Approve" on the request', async () => {
    await server.slack.press({
      channel: "C0GATES",
      ts: server.message.ts,
      actionId: "gatekeeper.approve",
      user: "U0BEN",
    });
  });

  await then('"/v1/gates/<gate>" shows the state "pending" that waits for "maintainers"', async () => {
    const gate = await server.gate(server.id);
    expect(gate).toMatchObject({ state: "pending", waitingFor: ["maintainers"] });
    expect(gate?.record).toBeUndefined();
  });

  await then(
    'the thread has the reply "<@U0BEN> is not in maintainers, so this decision does not count."',
    async () => {
      expect(replies(server.slack, server.message)).toEqual([
        expect.stringMatching(
          /^<@U0BEN> is not in maintainers, so this decision does not count\.\n\[gatekeeper g[0-9a-f]{16} refused [0-9.]+\]$/,
        ),
      ]);
    },
  );
});
