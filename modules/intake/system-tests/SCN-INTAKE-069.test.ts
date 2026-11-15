import { scenario } from "@opensoftware/testkit";
import { proving, workAs } from "./server.ts";

scenario("SCN-INTAKE-069", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  await given(
    'the server runs at "2026-01-01T00:00:41Z" with "INTAKE_PERSON_KEYS" set to the key set of the console',
    async () => {
      server = await proving(sut, fakes, { OSF_NOW: "2026-01-01T00:00:41Z" });
    },
  );

  let answer: Awaited<ReturnType<typeof server.post>>;
  let proof = "";
  await when(
    'the console posts the README\'s "work.json" with the requester "ada@acme.dev" and its proof of "ada@acme.dev" that ended at "2026-01-01T00:00:30Z"',
    async () => {
      const body = workAs(fakes, { kind: "person", id: "ada@acme.dev" });
      // The fake issuer signs at 2026-01-01T00:00:00Z for 30 seconds; the server allows 10 seconds of skew.
      proof = await server.prove("ada@acme.dev", body);
      answer = await server.post(body, proof);
    },
  );

  await then(
    'the answer has the status 401 and the detail "the person proof ended at 2026-01-01T00:00:30Z"',
    async () => {
      expect(answer.status).toBe(401);
      expect(answer.body).toMatchObject({
        title: "Unauthorized",
        detail: "the person proof ended at 2026-01-01T00:00:30Z",
      });
    },
  );

  await then('the error output names "ada@acme.dev" and the reason, and does not hold the proof', async () => {
    const { stderr } = sut.http.output();
    expect(stderr).toContain(
      'intake: refused POST /v1/work-items for "ada@acme.dev": the person proof ended at 2026-01-01T00:00:30Z\n',
    );
    expect(stderr).not.toContain(proof.split(".")[2]);
  });
});
