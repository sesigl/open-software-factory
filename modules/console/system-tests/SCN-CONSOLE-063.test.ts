import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, GATE, gatedRun, pendingGate, RUN, sendForm, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-063", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and gatekeeper that answers a decision of the gate "g0123456789abcdef" with 403 and "ada@acme.dev is not in leads"',
    async () => {
      const api = await foreman(fakes, [gatedRun()]);
      const gatekeeper = await fakes.http([
        { path: `/v1/gates/${GATE}`, body: pendingGate },
        {
          method: "POST",
          path: `/v1/gates/${GATE}/decisions`,
          status: 403,
          body: { title: "The decision does not count", status: 403, detail: "ada@acme.dev is not in leads" },
        },
      ]);
      url = await serving(sut, [api.url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_GATEKEEPER_URL: gatekeeper.url,
      });
    },
  );

  let answer: Awaited<ReturnType<typeof sendForm>>;
  await when('the person "ada@acme.dev" sends the form "Approve" of the run\'s page', async () => {
    answer = await sendForm(url, `/runs/${RUN}/gates/${GATE}`, { decision: "approved" }, ADA);
  });

  await then('the page answers 403 and says "ada@acme.dev is not in leads"', async () => {
    expect(answer.status).toBe(403);
    expect(text(answer.html)).toContain("ada@acme.dev is not in leads");
  });
});
