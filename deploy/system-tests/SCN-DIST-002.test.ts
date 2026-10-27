import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-002", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env" except "FOREMAN_API_TOKEN"',
    async () => {
      compose = await profile(sut, "FOREMAN_API_TOKEN");
    },
  );

  let up: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose up --detach --wait"', async () => {
    up = await compose.run(words("docker compose up --detach --wait"));
  });

  await then("the command exits with code 1", async () => {
    expect(up.exitCode, up.stderr).toBe(1);
  });

  await then('the output contains "set FOREMAN_API_TOKEN in .env"', async () => {
    expect(up.stdout + up.stderr).toContain("set FOREMAN_API_TOKEN in .env");
  });
});
