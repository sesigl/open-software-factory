import { scenario } from "@opensoftware/testkit";
import { COMPONENT_FILE, componentOf, putTemplate } from "./templates.ts";

scenario("SCN-REPO-175", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose component "src/components/List.astro" has a script that imports "../islands/list.mount.tsx"',
    async () => {
      const component = componentOf(["<script>", '  import "../islands/list.mount.tsx";', "</script>"]);
      await putTemplate(sut, component, COMPONENT_FILE);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TEMPLATE"', async () => {
    run = await sut.cli(["check", "TEMPLATE"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "TEMPLATE ok"', async () => {
    expect(run.stdout).toContain("TEMPLATE ok");
  });
});
