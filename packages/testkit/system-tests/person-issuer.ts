// The demo module of the fakes.personIssuer scenarios: a CLI that verifies a person proof with the issuer's key set.
import { demoModule } from "./module.ts";

const VERIFY = [
  'import { createHash, createPublicKey, verify } from "node:crypto";',
  'const [head, body, signature] = process.env.DEMO_PROOF.split(".");',
  "const { keys } = await (await fetch(process.env.DEMO_KEYS)).json();",
  'const header = JSON.parse(Buffer.from(head, "base64url").toString());',
  'const claims = JSON.parse(Buffer.from(body, "base64url").toString());',
  "const { kty, crv, x } = keys[0];",
  'const key = createPublicKey({ key: { kty, crv, x }, format: "jwk" });',
  'const valid = verify(null, Buffer.from(`${head}.${body}`), key, Buffer.from(signature, "base64url"));',
  'const digest = createHash("sha256").update(process.env.DEMO_BODY ?? "").digest("base64url");',
  "process.stdout.write(JSON.stringify({ valid, keys: keys.length, kid: header.kid === keys[0].kid,",
  "  header: { alg: header.alg, typ: header.typ }, claims, digest: claims.bodyDigest === digest }));",
  "",
].join("\n");

/** The module whose test runs `test` (TypeScript lines that set `issuer`, `proof` and `body`) and expects `printed`. */
export const issuerModule = (test: string[], printed: unknown) =>
  demoModule({
    bin: VERIFY,
    readme: [
      "# demo",
      "",
      "## Configuration",
      "",
      "| Variable | Meaning |",
      "| --- | --- |",
      "| `DEMO_KEYS` | The issuer's key set. |",
      "| `DEMO_PROOF` | The proof. |",
      "| `DEMO_BODY` | The request's body. |",
      "",
    ].join("\n"),
    steps: ["When the user verifies the proof", "Then the proof verifies with these claims"],
    test: [
      ...test,
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user verifies the proof', async () => {",
      "  run = await sut.cli([], { env: { DEMO_KEYS: issuer.url, DEMO_PROOF: proof, DEMO_BODY: body } });",
      "});",
      "await then('the proof verifies with these claims', async () => {",
      "  expect(run.exitCode, run.stderr).toBe(0);",
      `  expect(JSON.parse(run.stdout)).toEqual(${JSON.stringify(printed)});`,
      "});",
    ],
  });
