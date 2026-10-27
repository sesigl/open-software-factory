import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-006", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  await given('the operator ran "docker compose run --rm factory apply --agent implement"', async () => {
    const apply = await compose.run(words("docker compose run --rm factory apply --agent implement"));
    expect(apply.exitCode, apply.stderr).toBe(0);
  });

  let plan: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose run --rm factory plan"', async () => {
    plan = await compose.run(words("docker compose run --rm factory plan"));
  });

  await then("the command exits with code 0", async () => {
    expect(plan.exitCode, plan.stderr).toBe(0);
  });

  await then('the output contains "No changes."', async () => {
    expect(plan.stdout).toContain("No changes.");
  });
});
