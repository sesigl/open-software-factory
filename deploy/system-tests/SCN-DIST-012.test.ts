import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-012", async ({ sut, given, when, then }) => {
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
    'the stage "verify" of the resolved factory has the checks ["verify"] and the evidence "required"',
    async () => {
      // The first build of the image prints its log before the JSON.
      const json = resolve.stdout.slice(resolve.stdout.search(/^\{$/m));
      const factory = JSON.parse(json) as { workflow: { stage: string; checks?: string[]; evidence?: string }[] };
      const verify = factory.workflow.find((stage) => stage.stage === "verify");
      expect({ checks: verify?.checks, evidence: verify?.evidence }).toEqual({
        checks: ["verify"],
        evidence: "required",
      });
    },
  );
});
