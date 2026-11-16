import { type Compose, scenario } from "@opensoftware/testkit";
import { profile, SIGN_IN, words } from "./profile.ts";

/** INTAKE_API_TOKEN of the profile's .env, as profile() writes it. */
const TOKEN = "intake-token-1";
/** A person that a program names with the API token, with no proof of the console. */
const MADE_UP = { kind: "person", id: "varun@acme.dev" };
const DEDUPE_KEY = "task:delete-the-reports";

scenario("SCN-DIST-054", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and "CONSOLE_SIGNING_KEY" set',
    async () => {
      compose = await profile(sut, undefined, SIGN_IN);
    },
  );

  await given(
    'the operator ran "docker compose run --rm factory-repo", which commits the factory into its volume',
    async () => {
      const run = await compose.run(words("docker compose run --rm factory-repo"));
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  // Only intake with PostgreSQL and NATS, and the console without the services it waits for: the check of intake and
  // the console's key set need no other service, so the scenario adds no start of the whole profile.
  let intake = "";
  await when(
    'the operator runs "docker compose up --detach --wait intake" and "docker compose up --detach --wait --no-deps console"',
    async () => {
      for (const command of [
        "docker compose up --detach --wait intake",
        "docker compose up --detach --wait --no-deps console",
      ]) {
        const up = await compose.run(words(command));
        expect(up.exitCode, up.stderr).toBe(0);
      }
      intake = await compose.url("intake", 8080);
    },
  );

  let refused: Response;
  await when(
    'a program posts a work item to intake\'s "/v1/work-items" with "INTAKE_API_TOKEN" and the requester "varun@acme.dev" of the kind "person", without the header "OSF-Person"',
    async () => {
      refused = await fetch(`${intake}/v1/work-items`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({
          title: "Delete the reports",
          type: "task",
          requester: MADE_UP,
          origin: { source: "api" },
          dedupeKey: DEDUPE_KEY,
        }),
      });
    },
  );

  await then('intake answers 401 with "send OSF-Person: the console\'s proof of the person (ADR 0151)"', async () => {
    const body = (await refused.json()) as { detail?: string };
    expect({ status: refused.status, detail: body.detail }).toEqual({
      status: 401,
      detail: "send OSF-Person: the console's proof of the person (ADR 0151)",
    });
  });

  await then("intake holds no work item with the dedupe key of the post", async () => {
    const byKey = await fetch(`${intake}/v1/work-items?dedupeKey=${encodeURIComponent(DEDUPE_KEY)}`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(byKey.status).toBe(404);
  });

  await then('the console\'s "/.well-known/jwks.json" answers 200 with one key of "kty" "OKP"', async () => {
    const answer = await fetch(`${await compose.url("console", 8080)}/.well-known/jwks.json`);
    expect(answer.status).toBe(200);
    const { keys } = (await answer.json()) as { keys: { kty: string }[] };
    expect(keys.map(({ kty }) => kty)).toEqual(["OKP"]);
  });
});
