import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-005", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a merged GitHub pull request 7 of "acme/web" titled "Fix the sum" with the description "sum(2, 3) returned -1."',
    async () => {
      const pull = await commitPull(sut, { title: "Fix the sum", body: "sum(2, 3) returned -1." });
      github = await fakes.http([pull.route]);
    },
  );

  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      const run = await capture(sut, github);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(
    '"suite/web-7/instruction.md" holds the title "Fix the sum" and the description "sum(2, 3) returned -1."',
    async () => {
      expect(await sut.files.read("$OUTPUT/suite/web-7/instruction.md")).toBe("# Fix the sum\n\nsum(2, 3) returned -1.\n");
    },
  );
});
