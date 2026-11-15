import { type CliResult, scenario } from "@opensoftware/testkit";
import { foreman, healthRoute } from "./console.ts";
import { SIGNING_KEY } from "./proof.ts";

const REASON = "CONSOLE_SIGNING_KEY: a signing key is 64 hex digits, the seed of an Ed25519 key: key 1 of 1 is not";

scenario("SCN-CONSOLE-272", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('"CONSOLE_SIGNING_KEY" set to 63 hex digits', async () => {
    const api = await foreman(fakes, [], [healthRoute([{ name: "temporal", ok: true }])]);
    env = { CONSOLE_FOREMAN_URL: api.url, CONSOLE_SIGNING_KEY: SIGNING_KEY.slice(1) };
  });

  let doctor: CliResult;
  let serve: CliResult;
  await when('the user runs "console doctor" and "console serve"', async () => {
    doctor = await sut.cli(["doctor"], { env });
    serve = await sut.cli(["serve"], { env });
  });

  await then(
    '"console doctor" exits with code 1 and prints "FAIL  person proof: CONSOLE_SIGNING_KEY: a signing key is 64 hex digits, the seed of an Ed25519 key: key 1 of 1 is not: set it to 64 random hex digits, like "openssl rand -hex 32""',
    async () => {
      expect(doctor.exitCode).toBe(1);
      expect(doctor.stdout.split("\n")).toContain(
        `FAIL  person proof: ${REASON}: set it to 64 random hex digits, like "openssl rand -hex 32"`,
      );
    },
  );

  await then(
    '"console serve" exits with an error that says "CONSOLE_SIGNING_KEY: a signing key is 64 hex digits, the seed of an Ed25519 key: key 1 of 1 is not"',
    async () => {
      expect(serve.exitCode).not.toBe(0);
      expect(serve.stderr).toContain(REASON);
    },
  );

  await then("no output holds the key", async () => {
    const outputs = [doctor.stdout, doctor.stderr, serve.stdout, serve.stderr].join("\n");
    expect(outputs).not.toContain(SIGNING_KEY.slice(1, 17));
  });
});
