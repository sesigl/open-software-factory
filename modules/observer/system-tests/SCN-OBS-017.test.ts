import { scenario } from "@opensoftware/testkit";
import { problemsJson } from "./scores.ts";

scenario("SCN-OBS-017", async ({ sut, given, when, then }) => {
  await given('"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs', async () => {
    await sut.files.put("$INPUT/problems.json", problemsJson(30, 40));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer propose --repo https://github.com/acme/factory --problem scope-creep problems.json"',
    async () => {
      run = await sut.cli(
        ["propose", "--repo", "https://github.com/acme/factory", "--problem", "scope-creep", "problems.json"],
        { env: { OBSERVER_INFERENCE_URL: "http://127.0.0.1:9/v1" } },
      );
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "observer: no problem "scope-creep" in problems.json; it has: research-skill-used"',
    async () => {
      expect(run.stderr).toContain('observer: no problem "scope-creep" in problems.json; it has: research-skill-used');
    },
  );
});
