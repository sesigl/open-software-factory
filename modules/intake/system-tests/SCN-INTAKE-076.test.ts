import { scenario } from "@opensoftware/testkit";
import { postWork, serving, workAs } from "./server.ts";

scenario("SCN-INTAKE-076", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let keys = "";
  await given(
    'the server runs with "INTAKE_PERSON_KEYS" set to "console=<url>", where the key set answers 500',
    async () => {
      const broken = await fakes.http([{ path: "/.well-known/jwks.json", status: 500, body: {} }]);
      keys = `${broken.url}/.well-known/jwks.json`;
      server = await serving(sut, { INTAKE_PERSON_KEYS: `console=${keys}` });
    },
  );

  let answer: Awaited<ReturnType<typeof postWork>>;
  await when(
    'the console posts the README\'s "work.json" with the requester "ada@acme.dev" and its proof of "ada@acme.dev"',
    async () => {
      const issuer = await fakes.personIssuer();
      const body = workAs(fakes, { kind: "person", id: "ada@acme.dev" });
      const proof = await issuer.prove({ sub: "ada@acme.dev", aud: "intake", path: "/v1/work-items", body });
      answer = await postWork(server.url, body, proof);
    },
  );

  await then('the answer has the status 503 and a detail that names the issuer "console" and "HTTP 500"', async () => {
    expect(answer).toEqual({
      status: 503,
      body: {
        title: "Service Unavailable",
        status: 503,
        detail: `cannot fetch the key set of the issuer "console" at ${keys}: HTTP 500`,
      },
    });
  });
});
