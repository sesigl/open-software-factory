import { type PersonCheck, type PersonChecker, personChecker } from "@opensoftware/person-proof";
import type { FakeHttp, FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { at, CLAIMS, request } from "./proof.ts";

const ISSUERS = ["down", "broken", "private", "text"];

scenario("SCN-PPROOF-016", async ({ fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let keys: FakeHttp;
  let checker: PersonChecker;
  let urls: Record<string, string> = {};
  await given(
    'a checker of "foreman" with the issuers "down" at a closed port, "broken" that answers 500, "private" whose key holds "d" and "text" that answers no JSON',
    async () => {
      issuer = await fakes.personIssuer();
      const [key] = issuer.keys.keys;
      keys = await fakes.http([
        { path: "/broken", status: 500, body: { error: "down" } },
        { path: "/private", body: { keys: [{ ...key, d: "AAAA" }] } },
        { path: "/text", body: "keys", contentType: "text/plain" },
      ]);
      // fetch never connects to port 9 (discard), one of the Fetch standard's bad ports: no server is reached.
      urls = {
        down: "http://127.0.0.1:9/keys",
        broken: `${keys.url}/broken`,
        private: `${keys.url}/private`,
        text: `${keys.url}/text`,
      };
      const setting = ISSUERS.map((name) => `${name}=${urls[name]}`).join(",");
      checker = personChecker(setting, { audience: "foreman", now: at(0) });
    },
  );

  let checks: PersonCheck[] = [];
  await when("it checks a valid proof of each issuer", async () => {
    checks = await Promise.all(
      ISSUERS.map(async (iss) => checker.check(request(await issuer.prove({ ...CLAIMS, iss })))),
    );
  });

  await then(
    'each is refused with 503 and a reason that names the issuer and its URL: "cannot fetch", "HTTP 500", "/keys/0/d" and "is not valid person-keys"',
    async () => {
      expect(checks.map((check) => !check.ok && check.status)).toEqual([503, 503, 503, 503]);
      const reasons = checks.map((check) => (check.ok ? "" : check.reason));
      // The cause of fetch's failure, not its "fetch failed".
      expect(reasons[0]).toBe('cannot fetch the key set of the issuer "down" at http://127.0.0.1:9/keys: bad port');
      expect(reasons[1]).toBe(`cannot fetch the key set of the issuer "broken" at ${urls.broken}: HTTP 500`);
      expect(reasons[2]).toBe(
        `the key set of the issuer "private" at ${urls.private} is not valid person-keys: /keys/0/d unknown field`,
      );
      // A body that is no JSON is no object: the path of the whole document is "/".
      expect(reasons[3]).toBe(
        `the key set of the issuer "text" at ${urls.text} is not valid person-keys: / must be object`,
      );
      // The checks run at once, so the key sets are fetched in any order.
      expect(keys.requests().sort()).toEqual(["GET /broken", "GET /private", "GET /text"]);
    },
  );
});
