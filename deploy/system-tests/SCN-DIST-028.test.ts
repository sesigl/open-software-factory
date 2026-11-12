import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

/** A stage of the resolved factory, as far as the scenario reads it. */
interface Stage {
  stage: string;
  gate?: { policy: string; approvers?: string[] };
}

scenario("SCN-DIST-028", async ({ sut, given, when, then }) => {
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

  // A gate comes before its stage, so the gate of "implement" asks after "spec" opened its pull request.
  const stage = (name: string): Stage | undefined => {
    // The first build of the image prints its log before the JSON.
    const json = resolve.stdout.slice(resolve.stdout.search(/^\{$/m));
    return (JSON.parse(json) as { workflow: Stage[] }).workflow.find((each) => each.stage === name);
  };

  await then('the stage "spec" of the resolved factory has no gate', async () => {
    expect(stage("spec")).toBeDefined();
    expect(stage("spec")?.gate).toBeUndefined();
  });

  await then(
    'the stage "implement" of the resolved factory has the gate of "maintainers" with the policy "./policy/spec.rego"',
    async () => {
      expect(stage("implement")?.gate).toMatchObject({ policy: "./policy/spec.rego", approvers: ["maintainers"] });
    },
  );
});
