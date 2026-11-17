import { type CliResult, type FakeHttp, scenario } from "@opensoftware/testkit";
import { environment } from "./rehearsal.ts";

scenario("SCN-REPO-230", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given("a fake GitHub API that answers no call", async () => {
    github = await fakes.http([]);
  });

  let run: CliResult;
  await when(
    'the maintainer runs "osf rehearsal run --repository sesigl/open-software-factory --out rehearsal"',
    async () => {
      run = await sut.cli(["rehearsal", "run", "--repository", "sesigl/open-software-factory", "--out", "rehearsal"], {
        env: environment({ github, intake: github, foreman: github }),
      });
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then(
    'the error output is "osf rehearsal: sesigl/open-software-factory is this repository: the rehearsal runs only on a scratch repository"',
    async () => {
      expect(run.stderr).toBe(
        "osf rehearsal: sesigl/open-software-factory is this repository: the rehearsal runs only on a scratch repository\n",
      );
    },
  );

  await then("the fake GitHub API got no call", async () => {
    expect(github.requests()).toEqual([]);
  });
});
