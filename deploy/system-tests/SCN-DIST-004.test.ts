import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-004", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  await when('the operator runs "docker compose up --detach --wait console"', async () => {
    const up = await compose.run(words("docker compose up --detach --wait console"));
    expect(up.exitCode, up.stderr).toBe(0);
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
