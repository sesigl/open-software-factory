import { type FakeHttp, type ReadProof, scenario } from "@opensoftware/testkit";
import { ADA, foreman, NEW_RUN, RUN, runOf, sendRetryForm, serving } from "./console.ts";
import { IAT, posted, SIGNING_KEY } from "./proof.ts";

scenario("SCN-CONSOLE-270", async ({ sut, fakes, given, when, then }) => {
  let api: FakeHttp;
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and "CONSOLE_SIGNING_KEY", no access file, and a foreman with a failed run',
    async () => {
      const failed = runOf("Add a dark mode", { state: "failed" });
      const again = runOf("Add a dark mode", { runId: NEW_RUN });
      api = await foreman(
        fakes,
        [failed],
        [{ method: "POST", path: `/v1/runs/${RUN}/retry`, status: 201, body: again }],
      );
      await serving(sut, [api.url], { CONSOLE_USER_HEADER: "X-Forwarded-Email", CONSOLE_SIGNING_KEY: SIGNING_KEY });
    },
  );

  await when('the person "ada@acme.dev" sends the form "Run again" of the run', async () => {
    expect((await sendRetryForm(sut, `/runs/${RUN}`, ADA)).status).toBe(303);
  });

  let read: ReadProof;
  await then(
    'the foreman received a proof that the console\'s keys verify, of "ada@acme.dev" with the role "member" and no name, for "foreman" and "POST /v1/runs/run_5d41402abc4b2a76b971/retry"',
    async () => {
      const [call] = posted(api);
      read = await fakes.personProof(call?.proof ?? "", `${sut.http.url()}/.well-known/jwks.json`, call?.text);
      expect([read.verified, read.bodyMatches]).toEqual([true, true]);
      expect(read.claims).toEqual({
        iss: "console",
        sub: "ada@acme.dev",
        role: "member",
        aud: "foreman",
        iat: IAT,
        exp: IAT + 30,
        method: "POST",
        path: `/v1/runs/${RUN}/retry`,
        bodyDigest: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      });
    },
  );
});
