import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-184", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a library module whose system test has fakes.personIssuer sign a proof of "ada@acme.dev" for a body',
    async () => {
      module = demoModule({
        library: true,
        steps: ["When the test reads the proof three times", "Then only the first is verified with its body"],
        test: [
          "const issuer = await fakes.personIssuer();",
          "const other = await fakes.personIssuer();",
          `const body = '{"signal":"cancel"}';`,
          'const proof = await issuer.prove({ sub: "ada@acme.dev", aud: "foreman", path: "/v1/runs/run_1/signals", body });',
          "let reads: Awaited<ReturnType<typeof fakes.personProof>>[] = [];",
          "await when('the test reads the proof three times', async () => {",
          "  reads = await Promise.all([",
          "    fakes.personProof(proof, issuer.url, body),",
          "    fakes.personProof(proof, other.url, body),",
          `    fakes.personProof(proof, issuer.url, '{"signal":"approve"}'),`,
          "  ]);",
          "});",
          "await then('only the first is verified with its body', async () => {",
          "  expect(reads.map(({ verified, bodyMatches }) => [verified, bodyMatches])).toEqual([[true, true], [false, true], [true, false]]);",
          '  expect(reads[0]?.claims).toMatchObject({ iss: "console", sub: "ada@acme.dev", aud: "foreman", role: "member" });',
          '  expect(reads[0]?.header).toEqual({ alg: "Ed25519", typ: "osf-person+jwt", kid: issuer.keys.keys[0]?.kid });',
          "});",
        ],
      });
    },
  );

  await given(
    "the test reads it with fakes.personProof at the issuer's key set with that body, at another issuer's key set, and with another body",
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  await given(
    "it expects the claims and the header, and a verified proof with a matching body only for the first",
    async () => {
      expect(Object.keys(module)).toContain("$INPUT/system-tests/SCN-DEMO-001.test.ts");
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
