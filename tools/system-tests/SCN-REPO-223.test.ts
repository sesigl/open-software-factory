import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-223", async ({ sut, when, then }) => {
  let run: CliResult;
  await when(
    'the developer runs "osf released-images report --passed --run https://github.com/acme/factory/actions/runs/8 --ref 1a2b3c4"',
    async () => {
      run = await sut.cli([
        ...["released-images", "report", "--passed"],
        ...["--run", "https://github.com/acme/factory/actions/runs/8", "--ref", "1a2b3c4"],
      ]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output is "The deploy scenarios passed on the released images of 1a2b3c4: https://github.com/acme/factory/actions/runs/8. A person closes this issue once its cause is fixed."',
    async () => {
      expect(run.stdout).toBe(
        "The deploy scenarios passed on the released images of 1a2b3c4: https://github.com/acme/factory/actions/runs/8. A person closes this issue once its cause is fixed.\n",
      );
    },
  );
});
