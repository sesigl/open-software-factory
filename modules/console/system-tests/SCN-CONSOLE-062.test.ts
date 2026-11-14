import { scenario } from "@opensoftware/testkit";
import { ADA, buttons, foreman, GATE, gatedRun, openWith, pendingGate, RUN, sendForm, serving } from "./console.ts";

scenario("SCN-CONSOLE-062", async ({ sut, fakes, given, when, then }) => {
  let gatekeeper: Awaited<ReturnType<typeof fakes.http>>;
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email", a foreman with a run whose stage "ship" waits at the gate "g0123456789abcdef", and gatekeeper whose gate is "pending" for "leads"',
    async () => {
      const api = await foreman(fakes, [gatedRun()]);
      gatekeeper = await fakes.http([
        { path: `/v1/gates/${GATE}`, body: pendingGate },
        { method: "POST", path: `/v1/gates/${GATE}/decisions`, body: { ...pendingGate, state: "approved" } },
      ]);
      url = await serving(sut, [api.url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_GATEKEEPER_URL: gatekeeper.url,
        CONSOLE_GATEKEEPER_TOKEN: "gate-token",
      });
    },
  );

  let page: Awaited<ReturnType<typeof openWith>>;
  let answers: Awaited<ReturnType<typeof sendForm>>[] = [];
  await when(
    'the person "ada@acme.dev" sends the form "Approve" of the run\'s page, and the form "Reject" with the reason "needs a test"',
    async () => {
      page = await openWith(url, `/runs/${RUN}`, ADA);
      const action = `/runs/${RUN}/gates/${GATE}`;
      answers = [
        await sendForm(url, action, { decision: "approved", reason: "" }, ADA),
        await sendForm(url, action, { decision: "rejected", reason: "needs a test" }, ADA),
      ];
    },
  );

  await then('the page has the forms "Approve" and "Reject"', async () => {
    expect(buttons(page.html)).toEqual(["Steer", "Cancel", "Approve", "Reject"]);
    expect(page.html).toContain(`action="/runs/${RUN}/gates/${GATE}"`);
  });

  await then('each answer redirects to "/runs/run_5d41402abc4b2a76b971"', async () => {
    expect(answers.map(({ status, location }) => [status, location])).toEqual([
      [303, `/runs/${RUN}`],
      [303, `/runs/${RUN}`],
    ]);
  });

  await then(
    'gatekeeper received the decisions "approved" and "rejected" with the reason "needs a test", each by the person "ada@acme.dev"',
    async () => {
      const posted = gatekeeper.received().filter(({ method }) => method === "POST");
      const by = { kind: "person", id: "ada@acme.dev" };
      expect(posted.map(({ path }) => path)).toEqual([`/v1/gates/${GATE}/decisions`, `/v1/gates/${GATE}/decisions`]);
      expect(posted.map(({ body }) => body)).toEqual([
        { decision: "approved", by },
        { decision: "rejected", by, reason: "needs a test" },
      ]);
      const sent = gatekeeper.headers().filter(({ method }) => method === "POST");
      expect(sent[0]?.headers.authorization).toBe("Bearer gate-token");
    },
  );
});
