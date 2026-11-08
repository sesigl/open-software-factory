import { scenario } from "@opensoftware/testkit";

scenario("SCN-SCORE-057", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit scorers"', async () => {
    run = await sut.cli(["scorers"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("each line has the sampling rate two spaces after the longest scorer name", async () => {
    const lines = run.stdout.trimEnd().split("\n");
    const names = lines.map((line) => line.split(" ")[0] as string);
    const column = Math.max(...names.map((name) => name.length)) + 2;
    for (const line of lines) expect(line.slice(column)).toMatch(/^\d(\.\d+)?\s+\S/);
    for (const line of lines) expect(line.slice(column - 2, column)).toBe("  ");
  });
});
