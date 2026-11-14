import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-036", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  await when('the operator runs "docker compose up --detach --wait console"', async () => {
    const up = await compose.run(words("docker compose up --detach --wait console"));
    expect(up.exitCode, up.stderr).toBe(0);
  });

  let page = "";
  let policy: string | null = null;
  await then(
    'the console\'s page "/health" has the heading "Health" and the columns "Check", "State" and "What to do"',
    async () => {
      const response = await fetch(`${await compose.url("console", 8080)}/health`);
      page = await response.text();
      policy = response.headers.get("content-security-policy");
      expect([200, 503]).toContain(response.status);
      expect(page).toContain("<h1>Health</h1>");
      expect(page).toContain("<th>Check</th><th>State</th><th>What to do</th>");
    },
  );

  await then("the page allows only the console's own files and no script", async () => {
    expect(policy).toBe(
      "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
  });
});
