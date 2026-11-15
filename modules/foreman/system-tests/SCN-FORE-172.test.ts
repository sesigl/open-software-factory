import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";
import { posted, signals } from "./person-proof.ts";

scenario("SCN-FORE-172", async ({ sut, fakes, given, when, then }) => {
  const issuer = await fakes.personIssuer();
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a server with "FOREMAN_PERSON_KEYS" set to the issuer "console", and a run whose stage "implement" runs a turn that waits for "never"',
    async () => {
      run = await started(sut, fakes, {
        turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }],
        env: { FOREMAN_PERSON_KEYS: issuer.setting },
      });
      await run.untilStage(run.runId, 1, "running");
    },
  );

  let answer: Awaited<ReturnType<typeof posted>>;
  await when(
    'a caller with the API token posts the signal "cancel" by the person "grace@acme.dev" without "OSF-Person"',
    async () => {
      answer = await posted(sut, signals(run.runId), { type: "cancel", by: { kind: "person", id: "grace@acme.dev" } });
    },
  );

  await then(
    'the answer has the status 401 and the problem "send OSF-Person: the console\'s proof of the person (ADR 0151)"',
    async () => {
      expect(answer.status).toBe(401);
      expect(answer.headers["content-type"]).toBe("application/problem+json; charset=utf-8");
      expect(answer.body).toEqual({
        title: "Unauthorized",
        status: 401,
        detail: "send OSF-Person: the console's proof of the person (ADR 0151)",
      });
    },
  );

  await then('"/v1/runs/<id>" still shows the state "running" and no action', async () => {
    const view = await run.view(run.runId);
    expect(view.state).toBe("running");
    expect(view.actions).toBeUndefined();
  });
});
