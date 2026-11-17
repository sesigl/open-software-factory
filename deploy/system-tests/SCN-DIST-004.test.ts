import { scenario } from "@opensoftware/testkit";
import { type profile, sharedProfile } from "./profile.ts";

scenario("SCN-DIST-004", async ({ sut, fakes, given, when, then }) => {
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

  await then(
    'the console\'s page "/factory" lists the agents "triage", "spec", "implement", "review" and "ship"',
    async () => {
      const page = await (await fetch(`${await compose.url("console", 8080)}/factory`)).text();
      const agents = [...page.matchAll(/<a href="\/factory\/agents\/([a-z-]+)">/g)].map((match) => match[1]);
      expect(agents).toEqual(["triage", "spec", "implement", "review", "ship"]);
    },
  );
});
