import { scenario } from "@opensoftware/testkit";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-051", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked "maintainers" for approval of the README request', async () => {
    server = await askedServer(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a "message" event "approve" by "U0ADA" in the thread arrives with a wrong signature', async () => {
    const event = { type: "message", channel: "C0GATES", user: "U0ADA", text: "approve", ts: "1767225600.000009" };
    answer = await sut.http.request("POST", "/slack/events", {
      body: { type: "event_callback", event_id: "Ev9", event: { ...event, thread_ts: server.message.ts } },
      headers: { "x-slack-request-timestamp": "1767225600", "x-slack-signature": `v0=${"0".repeat(64)}` },
    });
  });

  await then("the answer has the status 401", async () => {
    expect(answer.status).toBe(401);
    expect(answer.body).toMatchObject({ status: 401, detail: expect.stringMatching(/signature does not match/) });
  });

  await then('"/v1/gates/<gate>" shows the state "pending" that waits for "maintainers"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "pending", waitingFor: ["maintainers"] });
  });
});
