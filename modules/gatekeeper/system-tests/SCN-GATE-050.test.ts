import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-050", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked "maintainers" for approval of the README request', async () => {
    server = await askedServer(sut, fakes);
  });

  const press = (actionId: string) =>
    server.slack.press({ channel: "C0GATES", ts: server.message.ts, actionId, user: "U0ADA" });

  await given('"slack:U0ADA" of "maintainers" pressed "Approve" on the request', async () => {
    await press("gatekeeper.approve");
  });

  await when('"slack:U0ADA" presses "Reject" on the request', async () => {
    await press("gatekeeper.reject");
  });

  await then('"/v1/gates/<gate>" shows the state "approved"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "approved", record: { decision: "approved" } });
  });

  await then('the thread has one reply, "Approved by <@U0ADA>."', async () => {
    expect(replies(server.slack, server.message)).toEqual([expect.stringMatching(/^Approved by <@U0ADA>\.\n/)]);
  });
});
