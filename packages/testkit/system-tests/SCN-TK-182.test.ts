import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { issuerModule } from "./person-issuer.ts";

scenario("SCN-TK-182", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI fetches the key set at "DEMO_KEYS", verifies the proof in "DEMO_PROOF" with its key, and prints the header and the claims',
    async () => {
      module = issuerModule(
        [
          "const issuer = await fakes.personIssuer();",
          `const body = '{"signal":"approve"}';`,
          'const proof = await issuer.prove({ sub: "ada@acme.dev", name: "Ada", aud: "foreman", path: "/v1/runs/run_1/signals", body });',
        ],
        {
          valid: true,
          keys: 1,
          kid: true,
          header: { alg: "Ed25519", typ: "osf-person+jwt" },
          claims: {
            iss: "console",
            sub: "ada@acme.dev",
            name: "Ada",
            role: "member",
            aud: "foreman",
            iat: 1767225600,
            exp: 1767225630,
            method: "POST",
            path: "/v1/runs/run_1/signals",
            // The SHA-256 of the body, in base64url.
            bodyDigest: "oqjDoqd94sL9NLousgFwDB9z4xrxT4qI_TDz52GcMEQ",
          },
          digest: true,
        },
      );
    },
  );

  await given(
    'its system test has fakes.personIssuer sign a proof of "ada@acme.dev" named "Ada" for "POST /v1/runs/run_1/signals" of "foreman" with a body, and expects a valid signature of the key\'s "kid", the type "osf-person+jwt", the issuer "console", the role "member", 2026-01-01T00:00:00Z and 30 seconds, and the body\'s SHA-256',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
