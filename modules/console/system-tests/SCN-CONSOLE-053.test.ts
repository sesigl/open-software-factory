import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, NEW_RUN, RUN, runOf, sendRetryForm, serving } from "./console.ts";

const DETAIL = `${RUN} already ran again as ${NEW_RUN}`;

scenario("SCN-CONSOLE-053", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman that answers a retry of "run_5d41402abc4b2a76b971" with 409 and "run_5d41402abc4b2a76b971 already ran again as run_0f3c7e91a2b44d6e8c05"',
    async () => {
      const refusal = { type: "about:blank", title: "Conflict", status: 409, detail: DETAIL };
      const api = await foreman(
        fakes,
        [runOf("Add a dark mode", { state: "failed" })],
        [{ method: "POST", path: `/v1/runs/${RUN}/retry`, status: 409, body: refusal }],
      );
      await serving(sut, [api.url], { CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let answer: Awaited<ReturnType<typeof sendRetryForm>>;
  await when('the person "ada@acme.dev" sends the form "run again" of "/runs/run_5d41402abc4b2a76b971"', async () => {
    answer = await sendRetryForm(sut, `/runs/${RUN}`, ADA);
  });

  await then(
    'the page answers 409 and says "run_5d41402abc4b2a76b971 already ran again as run_0f3c7e91a2b44d6e8c05"',
    async () => {
      expect(answer.status).toBe(409);
      expect(answer.text).toContain(DETAIL);
    },
  );
});
