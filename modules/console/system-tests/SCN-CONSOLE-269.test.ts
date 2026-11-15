import { type HttpResponse, scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { NEXT_SIGNING_KEY, SIGNING_KEY } from "./proof.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-269", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console that signs in with OpenID Connect at "localhost", with two keys in "CONSOLE_SIGNING_KEY"',
    async () => {
      const { env } = await signInEnv(sut, fakes);
      await serving(sut, [], { ...env, CONSOLE_SIGNING_KEY: `${SIGNING_KEY},${NEXT_SIGNING_KEY}` });
    },
  );

  let answer: HttpResponse;
  await when('a program asks for "/.well-known/jwks.json" at "127.0.0.1" without a session', async () => {
    expect(new URL(sut.http.url()).hostname).toBe("127.0.0.1");
    answer = await sut.http.get("/.well-known/jwks.json");
  });

  await then(
    'the answer is 200 with "cache-control: max-age=300" and a key set of two Ed25519 public keys, each with its "kid" and no private part',
    async () => {
      expect([answer.status, answer.headers["cache-control"]]).toEqual([200, "max-age=300"]);
      const key = {
        kty: "OKP",
        crv: "Ed25519",
        alg: "Ed25519",
        use: "sig",
        kid: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        x: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      };
      expect(answer.body).toEqual({ keys: [key, key] });
      const { keys } = answer.body as { keys: { kid: string }[] };
      expect(new Set(keys.map(({ kid }) => kid)).size).toBe(2);
    },
  );
});
