import { scenario } from "@opensoftware/testkit";
import { putTemplate, READS, SHOWS, templateOf } from "./templates.ts";

scenario("SCN-REPO-144", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose template "src/web/pages/runs.astro" filters the runs in its markup',
    async () => {
      await putTemplate(sut, templateOf(SHOWS, ["<p>{runs.filter((run) => run.late).length}</p>"]));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TEMPLATE"', async () => {
    run = await sut.cli(["check", "TEMPLATE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TEMPLATE modules/demo/src/web/pages/runs.astro:7 the markup computes: an expression reads a property, maps a list or switches on a value"',
    async () => {
      expect(run.stdout).toContain(
        "TEMPLATE modules/demo/src/web/pages/runs.astro:7 the markup computes: an expression reads a property, maps a list or switches on a value",
      );
    },
  );
});
