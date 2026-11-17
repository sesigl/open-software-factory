import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";

/** A workflow that sets OSF_TEST_CACHE for every event on line 6 and saves the test cache on line 9. */
const RELEASED = [
  "name: released-images",
  "on: workflow_dispatch",
  "jobs:",
  "  compose:",
  "    env:",
  "      OSF_TEST_CACHE: 1",
  "    steps:",
  "      - uses: actions/cache/save@v4",
  "        with: { path: .turbo/cache, key: turbo-tests-released }",
  "",
].join("\n");

scenario("SCN-REPO-224", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    '".github/workflows/released-images.yml" sets "OSF_TEST_CACHE: 1" on line 6 and saves ".turbo/cache" under the key "turbo-tests-released" on line 9',
    async () => {
      await putCached(sut, { ".github/workflows/released-images.yml": RELEASED });
    },
  );

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED .github/workflows/released-images.yml:6 sets OSF_TEST_CACHE outside pull requests: only a pull request may replay test results"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED .github/workflows/released-images.yml:6 sets OSF_TEST_CACHE outside pull requests: only a pull request may replay test results",
      );
    },
  );

  await then(
    'the output contains "AFFECTED .github/workflows/released-images.yml:9 writes the cache of the test results turbo-tests-, which pull requests replay: only verify.yml may"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED .github/workflows/released-images.yml:9 writes the cache of the test results turbo-tests-, which pull requests replay: only verify.yml may",
      );
    },
  );
});
