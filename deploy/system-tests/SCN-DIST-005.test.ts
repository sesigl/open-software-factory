import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-005", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let plan: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose run --rm factory plan"', async () => {
    plan = await compose.run(words("docker compose run --rm factory plan"));
  });

  await then("the command exits with code 0", async () => {
    expect(plan.exitCode, plan.stderr).toBe(0);
  });

  await then('the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."', async () => {
    expect(plan.stdout).toContain("Plan: 7 to add, 0 to change, 0 to remove, 0 drifted.");
  });
});
