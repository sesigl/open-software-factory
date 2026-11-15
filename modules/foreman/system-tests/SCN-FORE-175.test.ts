import { scenario } from "@opensoftware/testkit";
import { failed } from "./foreman.ts";
import { posted, proofOf } from "./person-proof.ts";

const VARUN = "varun@acme.dev";

scenario("SCN-FORE-175", async ({ sut, fakes, given, when, then }) => {
  const issuer = await fakes.personIssuer();
  let run: Awaited<ReturnType<typeof failed>>;
  await given(
    'a server with "FOREMAN_PERSON_KEYS" set to the issuer "console" ran the README\'s "work.json" and the "implement" turn ended with "refusal"',
    async () => {
      run = await failed(sut, fakes, { env: { FOREMAN_PERSON_KEYS: issuer.setting } });
    },
  );

  let answers: Awaited<ReturnType<typeof posted>>[] = [];
  await when(
    '"varun@acme.dev" posts a retry of the run without "OSF-Person", and then with the console\'s proof of "varun@acme.dev" named "Varun"',
    async () => {
      const path = `/v1/runs/${run.runId}/retry`;
      const retry = { by: { kind: "person", id: VARUN } };
      answers = [
        await posted(sut, path, retry),
        await posted(sut, path, retry, await proofOf(issuer, VARUN, path, retry, { name: "Varun" })),
      ];
    },
  );

  await then(
    'the first answer has the status 401 and the second the status 201 with a new run retried by the person "varun@acme.dev" named "Varun"',
    async () => {
      expect(answers.map((answer) => answer.status)).toEqual([401, 201]);
      expect(answers[1]?.body).toMatchObject({
        attempt: 2,
        retryOf: run.runId,
        retriedBy: { kind: "person", id: VARUN, displayName: "Varun" },
      });
    },
  );
});
