import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";
import { posted } from "./person-proof.ts";

const RUN = "/v1/runs/run_0a1b2c3d4e5f60718293";
const HUMAN = { kind: "human", id: "ada@acme.dev" };

scenario("SCN-FORE-177", async ({ sut, fakes, given, when, then }) => {
  const issuer = await fakes.personIssuer();
  await given('a server with "FOREMAN_PERSON_KEYS" set to the issuer "console"', async () => {
    await serving(sut, fakes, { env: { FOREMAN_PERSON_KEYS: issuer.setting } });
  });

  let answers: Awaited<ReturnType<typeof posted>>[] = [];
  await when(
    'a caller with the API token posts the signal "cancel" and a retry, each by the kind "human" and the made-up person "ada@acme.dev", without "OSF-Person", for a run the server does not know',
    async () => {
      answers = [
        await posted(sut, `${RUN}/signals`, { type: "cancel", by: HUMAN }),
        await posted(sut, `${RUN}/retry`, { by: HUMAN }),
      ];
    },
  );

  await then('both answers have the status 400 and a problem that names the kind "human"', async () => {
    const kind = '/by/kind: "human" is not "person" or "trigger"';
    expect(answers.map((answer) => answer.body)).toEqual([
      { title: "Bad request", status: 400, detail: `the body is not a signal: ${kind}` },
      { title: "Bad request", status: 400, detail: `the body is not a retry: ${kind}` },
    ]);
  });
});
