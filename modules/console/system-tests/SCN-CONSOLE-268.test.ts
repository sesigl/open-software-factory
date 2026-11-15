import { type FakeHttp, type ReadProof, scenario } from "@opensoftware/testkit";
import { foreman, GATE, gatedRun, pendingGate, RUN, serving, submittingIntake } from "./console.ts";
import { IAT, posted, SIGNING_KEY } from "./proof.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-268", async ({ sut, fakes, given, when, then }) => {
  let apis: { foreman: FakeHttp; gatekeeper: FakeHttp; intake: FakeHttp };
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect, with "CONSOLE_SIGNING_KEY", a foreman with a run that waits at a gate, its gatekeeper and intake',
    async () => {
      setup = await signInEnv(sut, fakes, { "ada@acme.dev": "admin", "grace@acme.dev": "factory-engineer" });
      const run = gatedRun();
      apis = {
        foreman: await foreman(
          fakes,
          [run],
          [{ method: "POST", path: `/v1/runs/${RUN}/signals`, status: 202, body: run }],
        ),
        gatekeeper: await fakes.http([
          { method: "POST", path: `/v1/gates/${GATE}/decisions`, body: { ...pendingGate, state: "approved" } },
        ]),
        intake: await submittingIntake(fakes),
      };
      await serving(sut, [], {
        ...setup.env,
        CONSOLE_FOREMAN_URL: apis.foreman.url,
        CONSOLE_GATEKEEPER_URL: apis.gatekeeper.url,
        CONSOLE_INTAKE_URL: apis.intake.url,
        CONSOLE_SIGNING_KEY: SIGNING_KEY,
      });
    },
  );

  const url = () => `http://localhost:${new URL(sut.http.url()).port}`;
  await given('the person "grace@acme.dev" named "Grace" with the role "factory-engineer" signed in', async () => {
    setup.oidc.signIn({ email: "grace@acme.dev", name: "Grace" });
    expect((await signedIn(sut)).path).toBe("/");
  });

  await when(
    'she sends the form "Cancel" of the run, the form "Approve" of its gate and the form "submit work"',
    async () => {
      const options = { headers: { origin: url() }, follow: false };
      const answers = [
        await sut.pages.send(`${url()}/runs/${RUN}/signals`, { type: "cancel" }, options),
        await sut.pages.send(`${url()}/runs/${RUN}/gates/${GATE}`, { decision: "approved", reason: "" }, options),
        await sut.pages.send(`${url()}/work`, { title: "Export reports as CSV" }, options),
      ];
      expect(answers.map(({ status }) => status)).toEqual([303, 303, 303]);
    },
  );

  const MODULES = ["foreman", "gatekeeper", "intake"] as const;
  let reads: ReadProof[] = [];
  await then(
    'foreman, gatekeeper and intake each received a proof in "OSF-Person" that the console\'s key set at "/.well-known/jwks.json" verifies, of the SHA-256 of the body they received',
    async () => {
      const calls = MODULES.map((name) => posted(apis[name])[0]);
      reads = await Promise.all(
        calls.map((call) =>
          fakes.personProof(call?.proof ?? "", `${sut.http.url()}/.well-known/jwks.json`, call?.text),
        ),
      );
      expect(reads.map(({ verified, bodyMatches }) => [verified, bodyMatches])).toEqual([
        [true, true],
        [true, true],
        [true, true],
      ]);
    },
  );

  await then(
    'each proof names the issuer "console", "grace@acme.dev", "Grace", "factory-engineer", its module as audience, 2026-01-01T00:00:00Z and 30 seconds later, "POST" and the request\'s path',
    async () => {
      const paths = [`/v1/runs/${RUN}/signals`, `/v1/gates/${GATE}/decisions`, "/v1/work-items"];
      expect(reads.map(({ claims }) => ({ ...claims, bodyDigest: undefined }))).toEqual(
        MODULES.map((aud, index) => ({
          iss: "console",
          sub: "grace@acme.dev",
          name: "Grace",
          role: "factory-engineer",
          aud,
          iat: IAT,
          exp: IAT + 30,
          method: "POST",
          path: paths[index],
          bodyDigest: undefined,
        })),
      );
      expect(MODULES.map((name) => posted(apis[name])[0]?.path)).toEqual(paths);
    },
  );

  await then('its header names "Ed25519", "osf-person+jwt" and the "kid" of the console\'s first key', async () => {
    const { body } = await sut.http.get("/.well-known/jwks.json");
    const keys = body as { keys: { kid: string }[] };
    expect(reads.map(({ header }) => header)).toEqual(
      MODULES.map(() => ({ alg: "Ed25519", typ: "osf-person+jwt", kid: keys.keys[0]?.kid })),
    );
  });
});
