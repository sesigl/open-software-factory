import { scenario } from "@opensoftware/testkit";
import { COMPONENT_FILE, componentOf, putTemplate } from "./templates.ts";

const ONLY = "a script only imports an island's mount script, a .tsx file in src/islands/ of its unit";

scenario("SCN-REPO-176", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose component "src/components/List.astro" has a script "is:inline" on line 5, a script that imports "../islands/list.mount.tsx" and calls "console.log" on line 9, and a script that imports "../pages/list.ts" on line 12',
    async () => {
      const component = componentOf([
        "<script is:inline>",
        '  import "../islands/list.mount.tsx";',
        "</script>",
        "<script>",
        '  console.log("mounted");',
        '  import "../islands/list.mount.tsx";',
        "</script>",
        '<script>import "../pages/list.ts";</script>',
      ]);
      await putTemplate(sut, component, COMPONENT_FILE);
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
    'the output contains "TEMPLATE modules/demo/src/components/List.astro:5 a script has no attributes: Astro bundles it into a file of its own"',
    async () => {
      expect(run.stdout).toContain(
        "TEMPLATE modules/demo/src/components/List.astro:5 a script has no attributes: Astro bundles it into a file of its own",
      );
    },
  );

  await then(
    `the output contains "TEMPLATE modules/demo/src/components/List.astro:9 a script only imports an island's mount script, a .tsx file in src/islands/ of its unit"`,
    async () => {
      expect(run.stdout).toContain(`TEMPLATE modules/demo/src/components/List.astro:9 ${ONLY}`);
    },
  );

  await then(
    `the output contains "TEMPLATE modules/demo/src/components/List.astro:12 a script only imports an island's mount script, a .tsx file in src/islands/ of its unit"`,
    async () => {
      expect(run.stdout).toContain(`TEMPLATE modules/demo/src/components/List.astro:12 ${ONLY}`);
    },
  );

  await then('the output does not contain "List.astro:6" or "List.astro:10"', async () => {
    expect(run.stdout).not.toContain("List.astro:6");
    expect(run.stdout).not.toContain("List.astro:10");
  });
});
