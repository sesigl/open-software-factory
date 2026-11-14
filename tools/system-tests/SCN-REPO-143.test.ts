import { scenario } from "@opensoftware/testkit";
import { putTemplate, READS, SHOWS, templateOf } from "./templates.ts";

scenario("SCN-REPO-143", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose template "src/web/pages/runs.astro" counts the runs in its frontmatter',
    async () => {
      await putTemplate(sut, templateOf([...SHOWS, "const count = runs.length;"], READS));
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
    'the output contains "TEMPLATE modules/demo/src/web/pages/runs.astro:6 the frontmatter holds only imports, the page\'s data and its status: compute in the route"',
    async () => {
      expect(run.stdout).toContain(
        "TEMPLATE modules/demo/src/web/pages/runs.astro:6 the frontmatter holds only imports, the page's data and its status: compute in the route",
      );
    },
  );
});
