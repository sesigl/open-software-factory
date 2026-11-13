import { scenario } from "@opensoftware/testkit";
import { profile, stageOf, words } from "./profile.ts";

scenario("SCN-DIST-029", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let resolve: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose run --rm factory resolve"', async () => {
    resolve = await compose.run(words("docker compose run --rm factory resolve"));
  });

  await then("the command exits with code 0", async () => {
    expect(resolve.exitCode, resolve.stderr).toBe(0);
  });

  await then(
    'the stage "ship" of the resolved factory has the checks ["verify"] and the evidence "required"',
    async () => {
      const ship = stageOf(resolve.stdout, "ship");
      expect({ checks: ship?.checks, evidence: ship?.evidence }).toEqual({ checks: ["verify"], evidence: "required" });
    },
  );
});
