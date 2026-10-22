import { scenario } from "@opensoftware/testkit";
import { problemsJson } from "./scores.ts";

scenario("SCN-OBS-018", async ({ sut, given, when, then }) => {
  await given('"problems.json" with the problem "research-skill-used" of 1 failure in 40 runs', async () => {
    await sut.files.put("$INPUT/problems.json", problemsJson(1, 40));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer propose --repo https://github.com/acme/factory problems.json"', async () => {
    run = await sut.cli(["propose", "--repo", "https://github.com/acme/factory", "problems.json"], {
      env: { OBSERVER_INFERENCE_URL: "http://127.0.0.1:9/v1" },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says "observer: the problem research-skill-used has 1 failed run; a proposal needs at least 2"',
    async () => {
      expect(run.stderr).toContain(
        "observer: the problem research-skill-used has 1 failed run; a proposal needs at least 2",
      );
    },
  );
});
