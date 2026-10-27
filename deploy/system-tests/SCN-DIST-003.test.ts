import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-003", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  await when('the operator runs "docker compose up --detach --wait console"', async () => {
    const up = await compose.run(words("docker compose up --detach --wait console"));
    expect(up.exitCode, up.stderr).toBe(0);
  });

  let page = "";
  await then('the console\'s page "/" answers 200 with the heading "Runs"', async () => {
    const response = await fetch(`${await compose.url("console", 8080)}/`);
    page = await response.text();
    expect(response.status).toBe(200);
    expect(page).toContain("<h1>Runs</h1>");
  });

  await then('the page does not say "did not answer"', async () => {
    expect(page).not.toContain("did not answer");
  });
});
