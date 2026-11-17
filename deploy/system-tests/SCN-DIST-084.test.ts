import { scenario } from "@opensoftware/testkit";
import { profile, stageOf, words } from "./profile.ts";

scenario("SCN-DIST-084", async ({ sut, given, when, then }) => {
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
    'the stage "verify" of the resolved factory has "wait: true", no agent, the checks ["verify"], the evidence "required" and "rework: implement"',
    async () => {
      expect(stageOf(resolve.stdout, "verify")).toEqual({
        stage: "verify",
        wait: true,
        checks: ["verify"],
        evidence: "required",
        rework: "implement",
      });
    },
  );
});
