import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase } from "./mutation.ts";

const TEMPLATE = "---\nconst { hour } = Astro.props;\n---\n<output>{hour}</output>\n";

scenario("SCN-REPO-172", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with module "demo", the limit "at least 70% of the mutants in changed lines", "src/clock.tsx" of 3 lines and the template "src/web/clock.astro"',
    async () => {
      await sut.files.put("$INPUT/modules/demo/src/web/clock.astro", TEMPLATE);
      base = await demoBase(sut, 3, "src/clock.tsx");
    },
  );

  await given('a change that adds lines 4 to 6 to "src/clock.tsx" and a line to "src/web/clock.astro"', async () => {
    await addLines(sut, 6, [4, 5, 6], "src/clock.tsx");
    await sut.files.put("$INPUT/modules/demo/src/web/clock.astro", `${TEMPLATE}<p>{hour}</p>\n`);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf mutation modules/demo --list" against the base commit', async () => {
    run = await sut.cli(["mutation", "modules/demo", "--list"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "src/clock.tsx:4-6"', async () => {
    expect(run.stdout).toBe("src/clock.tsx:4-6\n");
  });
});
