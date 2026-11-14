import { scenario } from "@opensoftware/testkit";
import { TODO } from "./vision.ts";

scenario("SCN-REPO-131", async ({ sut, given, when, then }) => {
  await given(
    'a "TODO.md" with the open item "T-01" whose two slices are ticked, the open item "T-02" with one open slice and the open item "T-03" without slices',
    async () => {
      await sut.files.put("$INPUT/TODO.md", TODO);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TODO"', async () => {
    run = await sut.cli(["check", "TODO"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TODO TODO.md:3 T-01 is open, but every slice is ticked: tick the item, or add the slice that is left"',
    async () => {
      expect(run.stdout).toContain(
        "TODO TODO.md:3 T-01 is open, but every slice is ticked: tick the item, or add the slice that is left",
      );
    },
  );

  await then('the output names neither "T-02" nor "T-03"', async () => {
    expect(run.stdout).not.toMatch(/T-02|T-03/);
  });
});
