import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { githubClient } from "./github.ts";

scenario("SCN-TK-173", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
  });

  await when(
    'a module reads the repository "tester/demo" and the first page of its pull requests through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      await api("GET", "");
      await api("GET", "/pulls?per_page=1&page=1");
    },
  );

  await then(
    'fakes.github lists the calls "GET /repos/tester/demo" and "GET /repos/tester/demo/pulls?per_page=1&page=1"',
    async () => {
      expect(github.calls()).toEqual(["GET /repos/tester/demo", "GET /repos/tester/demo/pulls?per_page=1&page=1"]);
    },
  );
});
