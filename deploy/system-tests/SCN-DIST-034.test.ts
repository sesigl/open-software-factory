import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-034", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env" and "IMPROVE_INTERVAL" set to "0"',
    async () => {
      compose = await profile(sut, undefined, { IMPROVE_INTERVAL: "0" });
    },
  );

  let improve: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose --profile improve run --rm improve"', async () => {
    improve = await compose.run(words("docker compose --profile improve run --rm improve"));
  });

  await then("the command exits with code 0", async () => {
    expect(improve.exitCode, improve.stderr).toBe(0);
  });

  await then(
    'the volume "improve" holds "reports/ledger.json" and "reports/problems.json" and no "scores/scores.jsonl"',
    async () => {
      const files = await compose.run(
        words("docker compose --profile improve run --rm --entrypoint find improve /home/node/data -type f"),
      );
      expect(files.exitCode, files.stderr).toBe(0);
      const found = files.stdout
        .split("\n")
        .map((line) => line.trim().replace("/home/node/data/", ""))
        .filter((line) => line.endsWith(".json") || line.endsWith(".jsonl"));
      expect(found.sort()).toEqual(["reports/ledger.json", "reports/problems.json"]);
    },
  );
});
