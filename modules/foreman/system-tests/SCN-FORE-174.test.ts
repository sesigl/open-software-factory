import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";
import { posted, proofOf, signals } from "./person-proof.ts";

const STEER = "use the existing date helper";
const MORE = "and add a test";
const GRACE = "grace@acme.dev";
const TOOL = { kind: "trigger", id: "tool:acme-portal" };

scenario("SCN-FORE-174", async ({ sut, fakes, given, when, then }) => {
  const issuer = await fakes.personIssuer();
  const portal = await fakes.personIssuer({ name: "acme-portal" });
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a server with "FOREMAN_PERSON_KEYS" set to the issuers "console" and "acme-portal", and a run whose stage "implement" runs a turn that waits for "never"',
    async () => {
      run = await started(sut, fakes, {
        turns: [
          { when: PLAN },
          { when: IMPLEMENT, waitsFor: "never" },
          { when: STEER, waitsFor: "never" },
          { when: MORE, waitsFor: "never" },
        ],
        env: { FOREMAN_PERSON_KEYS: `${issuer.setting},${portal.setting}` },
      });
      await run.untilStage(run.runId, 1, "running");
    },
  );

  let answers: { status: number }[] = [];
  await when(
    'the tool "acme-portal" posts the signal "steer" by "grace@acme.dev" with its own proof named "Grace", then the signal "steer" by the trigger "tool:acme-portal" without a proof, and then the signal "cancel" that names nobody',
    async () => {
      const path = signals(run.runId);
      const steer = { type: "steer", message: STEER, by: { kind: "person", id: GRACE } };
      answers = [
        await posted(sut, path, steer, await proofOf(portal, GRACE, path, steer, { name: "Grace" })),
        await posted(sut, path, { type: "steer", message: MORE, by: TOOL }),
        await posted(sut, path, { type: "cancel" }),
      ];
    },
  );

  await then("each answer has the status 202", async () => {
    expect(answers.map((answer) => answer.status)).toEqual([202, 202, 202]);
  });

  await then(
    '"/v1/runs/<id>" shows the state "cancelled" and the actions "steer" by the person "grace@acme.dev" named "Grace" and "steer" by the trigger "tool:acme-portal"',
    async () => {
      const view = await run.until(run.runId, "cancelled");
      const at = "2026-01-01T00:00:00.000Z";
      expect(view.actions).toEqual([
        { type: "steer", by: { kind: "person", id: GRACE, displayName: "Grace" }, at, message: STEER },
        { type: "steer", by: TOOL, at, message: MORE },
      ]);
    },
  );
});
