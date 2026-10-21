import { scenario } from "@opensoftware/testkit";
import { acceptedAdr } from "./repo.ts";

scenario("SCN-REPO-043", async ({ sut, fakes, given, when, then }) => {
  await given('a repository with the module template and an accepted ADR for the module "demo"', async () => {
    for (const [path, content] of Object.entries(fakes.fromRepository("modules/_template"))) {
      await sut.files.put(`$INPUT/modules/_template/${path}`, content);
    }
    const decisions = fakes.fromRepository("docs/decisions");
    const templateAdr = "0015-working-module-template.md";
    await sut.files.put(`$INPUT/docs/decisions/${templateAdr}`, decisions[templateAdr] ?? "");
    const reference = fakes.fromRepository("docs/reference");
    await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", reference["scenario-prefixes.md"] ?? "");
    await sut.files.put("$INPUT/docs/decisions/0002-demo.md", acceptedAdr("0002", "the module `modules/demo`"));
  });

  await given('the developer ran "osf new-module demo"', async () => {
    const created = await sut.cli(["new-module", "demo"]);
    if (created.exitCode !== 0) throw new Error(created.stdout + created.stderr);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check"', async () => {
    run = await sut.cli(["check"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "ARCH ok"', async () => {
    expect(run.stdout).toContain("ARCH ok");
  });
});
