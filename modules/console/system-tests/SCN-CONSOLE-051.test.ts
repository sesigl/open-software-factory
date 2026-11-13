import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, NEW_RUN, RUN, runOf, sendRetryForm, serving } from "./console.ts";

scenario("SCN-CONSOLE-051", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a failed run "run_5d41402abc4b2a76b971" whose retry starts the run "run_0f3c7e91a2b44d6e8c05"',
    async () => {
      const retry = runOf("Add a dark mode", { runId: NEW_RUN, attempt: 2, retryOf: RUN });
      api = await foreman(
        fakes,
        [runOf("Add a dark mode", { state: "failed" })],
        [{ method: "POST", path: `/v1/runs/${RUN}/retry`, status: 201, body: retry }],
      );
      url = await serving(sut, [api.url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_FOREMAN_TOKEN: "foreman-token",
      });
    },
  );

  let answer: Awaited<ReturnType<typeof sendRetryForm>>;
  await when('the person "ada@acme.dev" sends the form "run again" of "/runs/run_5d41402abc4b2a76b971"', async () => {
    answer = await sendRetryForm(url, `/runs/${RUN}`, ADA);
  });

  await then('the answer redirects to "/runs/run_0f3c7e91a2b44d6e8c05"', async () => {
    expect([answer.status, answer.location]).toEqual([303, `/runs/${NEW_RUN}`]);
  });

  await then('the foreman received a retry of "run_5d41402abc4b2a76b971" by the person "ada@acme.dev"', async () => {
    const posted = api.received().filter(({ method }) => method === "POST");
    expect(posted.map(({ path }) => path)).toEqual([`/v1/runs/${RUN}/retry`]);
    expect(posted[0]?.body).toEqual({ by: { kind: "person", id: "ada@acme.dev" } });
    const sent = api.headers().filter(({ method }) => method === "POST");
    expect(sent[0]?.headers.authorization).toBe("Bearer foreman-token");
  });
});
