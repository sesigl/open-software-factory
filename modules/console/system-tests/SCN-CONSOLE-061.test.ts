import { scenario } from "@opensoftware/testkit";
import { ADA, buttons, foreman, openWith, RUN, runOf, sendForm, serving } from "./console.ts";

const TYPES = ["take-over", "hand-back", "cancel"];

scenario("SCN-CONSOLE-061", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with the run "run_5d41402abc4b2a76b971" whose stage "implement" a person took over',
    async () => {
      const run = runOf("Add a dark mode", {
        state: "blocked",
        stages: [
          { stage: "implement", agent: "implementer", state: "blocked", takenOverAt: "2025-12-31T23:58:00.000Z" },
        ],
      });
      api = await foreman(fakes, [run], [{ method: "POST", path: `/v1/runs/${RUN}/signals`, status: 202, body: run }]);
      url = await serving(sut, [api.url], { CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let page: Awaited<ReturnType<typeof openWith>>;
  let answers: Awaited<ReturnType<typeof sendForm>>[] = [];
  await when(
    'the person "ada@acme.dev" sends the forms "Take over", "Hand back" and "Cancel" of the run\'s page',
    async () => {
      page = await openWith(url, `/runs/${RUN}`, ADA);
      answers = [];
      for (const type of TYPES) answers = [...answers, await sendForm(url, `/runs/${RUN}/signals`, { type }, ADA)];
    },
  );

  await then('the page has the form "Hand back"', async () => {
    expect(buttons(page.html)).toEqual(["Steer", "Hand back", "Cancel"]);
  });

  await then('each answer redirects to "/runs/run_5d41402abc4b2a76b971"', async () => {
    expect(answers.map(({ status, location }) => [status, location])).toEqual(TYPES.map(() => [303, `/runs/${RUN}`]));
  });

  await then(
    'the foreman received the signals "take-over", "hand-back" and "cancel", each by the person "ada@acme.dev"',
    async () => {
      const posted = api.received().filter(({ method }) => method === "POST");
      expect(posted.map(({ body }) => body)).toEqual(
        TYPES.map((type) => ({ type, by: { kind: "person", id: "ada@acme.dev" } })),
      );
    },
  );
});
