import { type CliResult, type FakeHttp, scenario } from "@opensoftware/testkit";
import { AT_GATE, COMPLETE, environment, foreman, gatekeeper, github, intake, READY, REPOSITORY } from "./rehearsal.ts";

scenario("SCN-REPO-233", async ({ sut, fakes, given, when, then }) => {
  const fake = {} as Record<"github" | "intake" | "foreman" | "gatekeeper", FakeHttp>;
  const comment = `/repos/${REPOSITORY}/issues/8/comments`;
  await given(
    'a fake GitHub API of "acme/scratch" that opens the issue 7 and shows the pull request 8 ready for review',
    async () => {
      fake.github = await github(fakes, [READY, { method: "POST", path: comment, status: 201, body: { id: 1 } }]);
    },
  );
  await given('a fake intake whose work item of the issue 7 has the run "run_1"', async () => {
    fake.intake = await intake(fakes);
  });
  await given(
    'a fake foreman whose run "run_1" waits at the gate of the stage "implement" with the pull request 8, and then is complete',
    async () => {
      fake.foreman = await foreman(fakes, [AT_GATE, COMPLETE]);
    },
  );
  await given('a fake gatekeeper whose gate "gate_1" was approved by "github:ada"', async () => {
    fake.gatekeeper = await gatekeeper(fakes);
  });

  let run: CliResult;
  await when(
    'the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal --gate token"',
    async () => {
      run = await sut.cli(["rehearsal", "run", "--repository", REPOSITORY, "--out", "rehearsal", "--gate", "token"], {
        env: environment(fake),
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the fake GitHub API got one comment "/approve" on the pull request 8', async () => {
    const comments = fake.github.received().filter((request) => request.path === comment);
    expect(comments.map((request) => request.body)).toEqual([{ body: "/approve" }]);
  });

  await then(
    '"rehearsal/summary.md" names the gate as answered with REHEARSAL_TOKEN by the workflow, not by a person',
    async () => {
      expect((await sut.files.read("$INPUT/rehearsal/summary.md")).split("\n")).toContain(
        "| Gate before implement | approved by github:ada (answered with REHEARSAL_TOKEN by the workflow, not by a person) |",
      );
    },
  );
});
