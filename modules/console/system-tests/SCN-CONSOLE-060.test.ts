import { scenario } from "@opensoftware/testkit";
import { ADA, buttons, foreman, openWith, RUN, runOf, sendForm, serving } from "./console.ts";

scenario("SCN-CONSOLE-060", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with the running run "run_5d41402abc4b2a76b971" whose stage "implement" runs',
    async () => {
      const run = runOf("Add a dark mode", {
        stages: [{ stage: "implement", agent: "implementer", state: "running" }],
      });
      api = await foreman(fakes, [run], [{ method: "POST", path: `/v1/runs/${RUN}/signals`, status: 202, body: run }]);
      url = await serving(sut, [api.url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_FOREMAN_TOKEN: "foreman-token",
      });
    },
  );

  let page: Awaited<ReturnType<typeof openWith>>;
  let answer: Awaited<ReturnType<typeof sendForm>>;
  await when(
    'the person "ada@acme.dev" opens the run\'s page and sends its form "Steer" with the message "use the existing date helper"',
    async () => {
      page = await openWith(url, `/runs/${RUN}`, ADA);
      answer = await sendForm(
        url,
        `/runs/${RUN}/signals`,
        { type: "steer", message: "use the existing date helper" },
        ADA,
      );
    },
  );

  await then('the page has the forms "Steer", "Take over" and "Cancel", and no form "Hand back"', async () => {
    expect(buttons(page.html)).toEqual(["Steer", "Take over", "Cancel"]);
    expect(page.html).toContain(`action="/runs/${RUN}/signals"`);
  });

  await then('the answer redirects to "/runs/run_5d41402abc4b2a76b971"', async () => {
    expect([answer.status, answer.location]).toEqual([303, `/runs/${RUN}`]);
  });

  await then(
    'the foreman received the signal "steer" with the message "use the existing date helper" by the person "ada@acme.dev"',
    async () => {
      const posted = api.received().filter(({ method }) => method === "POST");
      expect(posted.map(({ path }) => path)).toEqual([`/v1/runs/${RUN}/signals`]);
      expect(posted[0]?.body).toEqual({
        type: "steer",
        message: "use the existing date helper",
        by: { kind: "person", id: "ada@acme.dev" },
      });
      const sent = api.headers().filter(({ method }) => method === "POST");
      expect(sent[0]?.headers.authorization).toBe("Bearer foreman-token");
    },
  );
});
