import { type Compose, scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

type Services = Record<string, { environment?: Record<string, string | null> }>;

const CONFIG = "docker compose config --format json";

scenario("SCN-DIST-061", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let first: Awaited<ReturnType<Compose["run"]>>;
  let again: Awaited<ReturnType<Compose["run"]>>;
  await when(
    'the operator runs "docker compose config --format json", and again with "FOREMAN_MAX_STAGES=4" in ".env"',
    async () => {
      first = await compose.run(words(CONFIG));
      const more = await profile(sut, undefined, { FOREMAN_MAX_STAGES: "4" });
      again = await more.run(words(CONFIG));
      expect(first.exitCode, first.stderr).toBe(0);
      expect(again.exitCode, again.stderr).toBe(0);
    },
  );

  await then('the service "foreman" sets "FOREMAN_MAX_STAGES" to "2", and then to "4"', async () => {
    const foreman = (stdout: string) => (JSON.parse(stdout) as { services: Services }).services.foreman?.environment;
    expect(foreman(first.stdout)?.FOREMAN_MAX_STAGES).toBe("2");
    expect(foreman(again.stdout)?.FOREMAN_MAX_STAGES).toBe("4");
  });
});
