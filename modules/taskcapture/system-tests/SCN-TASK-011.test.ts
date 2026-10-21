import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-011", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a merged GitHub pull request 7 of a repository with a "package.json"', async () => {
    pull = await commitPull(sut, {});
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github);
    },
  );

  await then(
    '"suite/web-7/environment/Dockerfile" holds the lines "FROM node:24-bookworm", "WORKDIR /app", "COPY repo/ /app/" and "RUN npm install"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(await sut.files.read("$OUTPUT/suite/web-7/environment/Dockerfile")).toBe(
        "FROM node:24-bookworm\nWORKDIR /app\nCOPY repo/ /app/\nRUN npm install\n",
      );
    },
  );

  await then('"suite/web-7/tests/test.sh" holds the line "if npm test; then"', async () => {
    expect((await sut.files.read("$OUTPUT/suite/web-7/tests/test.sh")).split("\n")).toContain("if npm test; then");
  });
});
