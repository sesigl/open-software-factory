import { scenario } from "@opensoftware/testkit";
import { type profile, sharedProfile } from "./profile.ts";

scenario("SCN-DIST-003", async ({ sut, fakes, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  let shared: Awaited<ReturnType<typeof sharedProfile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    shared = await sharedProfile(sut, fakes);
    compose = shared.sut.compose("compose/compose.yaml");
  });

  await when('the operator runs "docker compose up --detach --wait"', async () => {
    // The group's one start ran the command; this is its result.
    expect(shared.result.exitCode, shared.result.stderr).toBe(0);
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
