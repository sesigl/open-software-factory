import { scenario } from "@opensoftware/testkit";
import { problemsJson } from "./scores.ts";

scenario("SCN-OBS-031", async ({ sut, given, when, then }) => {
  await given('"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs', async () => {
    await sut.files.put("$INPUT/problems.json", problemsJson(30, 40));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer propose --repo http://127.0.0.1:9/acme/factory problems.json"', async () => {
    run = await sut.cli(["propose", "--repo", "http://127.0.0.1:9/acme/factory", "problems.json"], {
      env: { OBSERVER_INFERENCE_URL: "http://127.0.0.1:9/v1", OBSERVER_FORGE_TOKEN: "forge-token" },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output starts with "observer: git clone failed"', async () => {
    expect(run.stderr.startsWith("observer: git clone failed"), run.stderr).toBe(true);
    expect(run.stderr).not.toContain("forge-token");
  });
});
