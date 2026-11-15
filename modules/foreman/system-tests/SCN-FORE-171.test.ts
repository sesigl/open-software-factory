import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";
import { posted, proofOf, signals } from "./person-proof.ts";

const STEER = "use the existing date helper";
const ADA = "ada@acme.dev";

scenario("SCN-FORE-171", async ({ sut, fakes, given, when, then }) => {
  const issuer = await fakes.personIssuer();
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a server with "FOREMAN_PERSON_KEYS" set to the issuer "console", and a run whose stage "implement" runs a turn that waits for "never"',
    async () => {
      run = await started(sut, fakes, {
        turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }, { when: STEER, waitsFor: "never" }],
        env: { FOREMAN_PERSON_KEYS: issuer.setting },
      });
      await run.untilStage(run.runId, 1, "running");
    },
  );

  let answers: { status: number }[] = [];
  await when(
    '"ada@acme.dev" posts the signal "steer" with the message "use the existing date helper" and the display name "Someone else", with the console\'s proof of "ada@acme.dev" named "Ada", and then the signal "cancel" with its proof',
    async () => {
      const path = signals(run.runId);
      const steer = { type: "steer", message: STEER, by: { kind: "person", id: ADA, displayName: "Someone else" } };
      const cancel = { type: "cancel", by: { kind: "person", id: ADA } };
      answers = [
        await posted(sut, path, steer, await proofOf(issuer, ADA, path, steer, { name: "Ada" })),
        await posted(sut, path, cancel, await proofOf(issuer, ADA, path, cancel, { name: "Ada" })),
      ];
    },
  );

  await then("both answers have the status 202", async () => {
    expect(answers.map((answer) => answer.status)).toEqual([202, 202]);
  });

  await then(
    '"/v1/runs/<id>" shows the state "cancelled" and the actions "steer" and "cancel", each by the person "ada@acme.dev" named "Ada"',
    async () => {
      const view = await run.until(run.runId, "cancelled");
      const by = { kind: "person", id: ADA, displayName: "Ada" };
      const at = "2026-01-01T00:00:00.000Z";
      expect(view.actions).toEqual([
        { type: "steer", by, at, message: STEER },
        { type: "cancel", by, at },
      ]);
    },
  );
});
