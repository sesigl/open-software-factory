import { scenario } from "@opensoftware/testkit";
import { type profile, sharedProfile } from "./profile.ts";

scenario("SCN-DIST-083", async ({ sut, fakes, given, when, then }) => {
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

  await then('the log of the service "gatekeeper" does not contain "GATEKEEPER_SIGNING_KEY is not set"', async () => {
    const logs = await compose.run(["logs", "--no-color", "gatekeeper"]);
    expect(logs.exitCode, logs.stderr).toBe(0);
    // The log of the server that started: its line of the port, and no word of unsigned records.
    expect(logs.stdout + logs.stderr).toMatch(/gatekeeper serves .* on port 8080/);
    expect(logs.stdout + logs.stderr).not.toContain("GATEKEEPER_SIGNING_KEY is not set");
  });
});
