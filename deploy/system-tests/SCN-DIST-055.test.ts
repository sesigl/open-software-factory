import { type Compose, scenario } from "@opensoftware/testkit";
import { profile, SIGN_IN, words } from "./profile.ts";

const WARNING =
  "WARN  person proof: set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs";

scenario("SCN-DIST-055", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and no "CONSOLE_SIGNING_KEY"',
    async () => {
      compose = await profile(sut, "CONSOLE_SIGNING_KEY", SIGN_IN);
    },
  );

  // Without the services the console checks, doctor fails on them and exits 1; the scenario reads only the line of
  // the person proof, which needs no other service.
  let doctor: Awaited<ReturnType<Compose["run"]>>;
  await when('the operator runs "docker compose run --rm --no-deps console console doctor"', async () => {
    doctor = await compose.run(words("docker compose run --rm --no-deps console console doctor"));
  });

  await then(
    'the output has the line "WARN  person proof: set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs"',
    async () => {
      expect(doctor.stdout.split("\n"), doctor.stderr).toContain(WARNING);
    },
  );

  await then('no line of the output starts with "FAIL  person proof"', async () => {
    expect(doctor.stdout.split("\n").filter((line) => line.startsWith("FAIL  person proof"))).toEqual([]);
  });
});
