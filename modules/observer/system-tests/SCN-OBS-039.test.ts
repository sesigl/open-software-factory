import { scenario } from "@opensoftware/testkit";
import { problemsJson } from "./scores.ts";

scenario("SCN-OBS-039", async ({ sut, given, when, then }) => {
  await given('"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs', async () => {
    await sut.files.put("$INPUT/problems.json", problemsJson(30, 40));
  });

  let notUrl: Awaited<ReturnType<typeof sut.cli>>;
  let longer: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer propose --repo <URL> problems.json" with the URLs "not a URL" and "https://github.com/acme/factory/tree"',
    async () => {
      const env = { OBSERVER_INFERENCE_URL: "http://127.0.0.1:9/v1" };
      notUrl = await sut.cli(["propose", "--repo", "not a URL", "problems.json"], { env });
      longer = await sut.cli(["propose", "--repo", "https://github.com/acme/factory/tree", "problems.json"], { env });
    },
  );

  await then(
    'both exit with code 2; the error output says "observer: not a URL is not a URL like https://github.com/acme/factory" and "observer: https://github.com/acme/factory/tree is not a repository URL like https://github.com/acme/factory"',
    async () => {
      expect([notUrl.exitCode, longer.exitCode], notUrl.stderr + longer.stderr).toEqual([2, 2]);
      expect([notUrl.stderr, longer.stderr]).toEqual([
        "observer: not a URL is not a URL like https://github.com/acme/factory\n",
        "observer: https://github.com/acme/factory/tree is not a repository URL like https://github.com/acme/factory\n",
      ]);
    },
  );
});
