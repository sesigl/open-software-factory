import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { issuerModule } from "./person-issuer.ts";

scenario("SCN-TK-183", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI fetches the key set at "DEMO_KEYS", verifies the proof in "DEMO_PROOF" with its key, and prints the header and the claims',
    async () => {
      module = issuerModule(
        [
          'const issuer = await fakes.personIssuer({ name: "acme-portal" });',
          "expect(issuer.setting).toBe(`acme-portal=${issuer.url}`);",
          "expect(issuer.name).toBe('acme-portal');",
          'const body = "";',
          "const proof = await issuer.prove(",
          '  { sub: "grace@acme.dev", aud: "gatekeeper", path: "/v1/gates/g1/decisions", role: "admin", exp: undefined },',
          '  { typ: "JWT", alg: "EdDSA" },',
          ");",
        ],
        {
          valid: true,
          keys: 1,
          kid: true,
          header: { alg: "EdDSA", typ: "JWT" },
          claims: {
            iss: "acme-portal",
            sub: "grace@acme.dev",
            role: "admin",
            aud: "gatekeeper",
            iat: 1767225600,
            method: "POST",
            path: "/v1/gates/g1/decisions",
            // The SHA-256 of an empty body, in base64url.
            bodyDigest: "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
          },
          digest: true,
        },
      );
    },
  );

  await given(
    'its system test starts fakes.personIssuer named "acme-portal", expects the setting "acme-portal=<url>", and has it sign a proof without "exp", with the role "admin", the type "JWT" and the algorithm "EdDSA"',
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
