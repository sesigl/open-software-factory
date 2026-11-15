import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";
import { posted, proofOf } from "./person-proof.ts";

const ADA = "ada@acme.dev";
const PATH = "/v1/runs/run_0a1b2c3d4e5f60718293/signals";
const OTHER_PATH = "/v1/runs/run_ffffffffffffffffffff/signals";
const BODY = { type: "cancel", by: { kind: "person", id: ADA } };
/** The testkit's clock, 2026-01-01T00:00:00Z, in seconds. */
const NOW = 1767225600;

scenario("SCN-FORE-173", async ({ sut, fakes, given, when, then }) => {
  const issuer = await fakes.personIssuer();
  const backoffice = await fakes.personIssuer({ name: "backoffice" });
  const down = await fakes.http([{ method: "GET", path: "/.well-known/jwks.json", status: 500, body: {} }]);
  const downKeys = `${down.url}/.well-known/jwks.json`;
  await given(
    'a server with "FOREMAN_PERSON_KEYS" set to the issuer "console" and the issuer "backoffice", whose key set answers 500',
    async () => {
      await serving(sut, fakes, { env: { FOREMAN_PERSON_KEYS: `${issuer.setting},backoffice=${downKeys}` } });
    },
  );

  let proofs: string[] = [];
  let answers: Awaited<ReturnType<typeof posted>>[] = [];
  await when(
    '"ada@acme.dev" posts the signal "cancel" to "/v1/runs/run_0a1b2c3d4e5f60718293/signals" with a proof of the console that ended 70 seconds ago, one for "gatekeeper", one for the path of another run, one for another body, one of "grace@acme.dev", and one of "backoffice"',
    async () => {
      proofs = await Promise.all([
        proofOf(issuer, ADA, PATH, BODY, { iat: NOW - 100, exp: NOW - 70 }),
        proofOf(issuer, ADA, PATH, BODY, { aud: "gatekeeper" }),
        proofOf(issuer, ADA, OTHER_PATH, BODY),
        proofOf(issuer, ADA, PATH, { ...BODY, type: "steer" }),
        proofOf(issuer, "grace@acme.dev", PATH, BODY),
        proofOf(backoffice, ADA, PATH, BODY),
      ]);
      const [ended, gatekeeper, otherPath, otherBody, grace, unread] = proofs as string[];
      // One after the other, so the log holds the refusals in this order.
      answers = [
        await posted(sut, PATH, BODY, ended),
        await posted(sut, PATH, BODY, gatekeeper),
        await posted(sut, PATH, BODY, otherPath),
        await posted(sut, PATH, BODY, otherBody),
        await posted(sut, PATH, BODY, grace),
        await posted(sut, PATH, BODY, unread),
      ];
    },
  );

  await then(
    'the answers have the status 401 with the end and with the audience "gatekeeper", 403 with the path, the body and the person, and 503 with the issuer "backoffice"',
    async () => {
      const unauthorized = "Unauthorized";
      const forbidden = "The person proof does not fit the request";
      expect(answers.map((answer) => answer.body)).toEqual([
        { title: unauthorized, status: 401, detail: "the person proof ended at 2025-12-31T23:58:50Z" },
        { title: unauthorized, status: 401, detail: 'the person proof is for "gatekeeper", not "foreman"' },
        {
          title: forbidden,
          status: 403,
          detail: `the person proof's path "${OTHER_PATH}" is not this request's "${PATH}"`,
        },
        { title: forbidden, status: 403, detail: "the person proof's bodyDigest is not this request's body" },
        { title: forbidden, status: 403, detail: `the person proof's sub "grace@acme.dev" is not the actor "${ADA}"` },
        {
          title: "The person proof cannot be checked",
          status: 503,
          detail: `cannot fetch the key set of the issuer "backoffice" at ${downKeys}: HTTP 500`,
        },
      ]);
      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 403, 403, 403, 503]);
    },
  );

  await then(
    "the server logged each refusal with its path, the person the proof names and its reason, and no proof",
    async () => {
      const { stderr } = sut.http.output();
      const refused = stderr.split("\n").filter((line) => line.startsWith("foreman: refused "));
      const of = (person: string) => `foreman: refused POST ${PATH} of "${person}": `;
      expect(refused).toEqual([
        `${of(ADA)}the person proof ended at 2025-12-31T23:58:50Z`,
        `${of(ADA)}the person proof is for "gatekeeper", not "foreman"`,
        `${of(ADA)}the person proof's path "${OTHER_PATH}" is not this request's "${PATH}"`,
        `${of(ADA)}the person proof's bodyDigest is not this request's body`,
        `${of("grace@acme.dev")}the person proof's sub "grace@acme.dev" is not the actor "${ADA}"`,
        `${of(ADA)}cannot fetch the key set of the issuer "backoffice" at ${downKeys}: HTTP 500`,
      ]);
      expect(proofs.filter((proof) => stderr.includes(proof))).toEqual([]);
    },
  );
});
