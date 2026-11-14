import { scenario } from "@opensoftware/testkit";
import { AUTH, askedServer } from "./server.ts";

const ADA = { kind: "person", id: "slack:U0ADA" } as const;
const MISSING = "g0000000000000000";

scenario("SCN-GATE-097", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  const decide = (gateId: string, body: unknown) =>
    server.api().POST("/v1/gates/{gateId}/decisions", {
      params: { path: { gateId } },
      body: body as never,
      headers: AUTH,
    });
  await given(
    'the server asked "maintainers" for approval of the README request, and "slack:U0ADA" rejected it through the API without a reason',
    async () => {
      server = await askedServer(sut, fakes);
      expect((await decide(server.id, { decision: "rejected", by: ADA })).response.status).toBe(200);
    },
  );

  let answers: Awaited<ReturnType<typeof decide>>[] = [];
  await when(
    'a program posts a decision without the person\'s ID, the decision "maybe", a decision of the gate "g0000000000000000" and the decision "approved" by "slack:U0ADA"',
    async () => {
      answers = [
        await decide(server.id, { decision: "approved", by: { kind: "person", id: "" } }),
        await decide(server.id, { decision: "maybe", by: ADA }),
        await decide(MISSING, { decision: "approved", by: ADA }),
        await decide(server.id, { decision: "approved", by: ADA }),
      ];
    },
  );

  await then("the answers have the statuses 400, 400, 404 and 409", async () => {
    expect(answers.map(({ response }) => response.status)).toEqual([400, 400, 404, 409]);
  });

  await then(
    'their problems say \'the decision: the field "by" must name the person\', \'the decision: the field "decision" must be approved or rejected\', "the server has no gate g0000000000000000" and "the gate <gate> is rejected"',
    async () => {
      expect(answers.map(({ error }) => (error as { detail?: string }).detail)).toEqual([
        'the decision: the field "by" must name the person',
        'the decision: the field "decision" must be approved or rejected',
        `the server has no gate ${MISSING}`,
        `the gate ${server.id} is rejected`,
      ]);
    },
  );

  await then('"/v1/gates/<gate>" shows a record rejected by "slack:U0ADA" without a reason', async () => {
    const record = (await server.gate(server.id))?.record;
    expect(record).toMatchObject({ decision: "rejected", decidedBy: ADA });
    expect(record).not.toHaveProperty("reason");
  });
});
