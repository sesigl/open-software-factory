import { scenario } from "@opensoftware/testkit";
import { opensPage } from "./affected.ts";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-141", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(`$INPUT/${path}`, content);
  });

  await given(
    'the test clicks the button "Save" of a page that sut.browser opened, fills the field "Name" and reads the text "Saved"',
    async () => {
      const assertion = [
        opensPage,
        'await page.getByLabel("Name").fill("Ada"); await page.getByRole("button", { name: "Save" }).click(); await page.getByText("Saved").waitFor();',
        "expect(run.exitCode).toBe(0);",
      ];
      await sut.files.put(`$INPUT/${DEMO_TEST}`, systemTest({ assertion: assertion.join("\n    ") }));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check UI-QUERY"', async () => {
    run = await sut.cli(["check", "UI-QUERY"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "UI-QUERY ok"', async () => {
    expect(run.stdout).toContain("UI-QUERY ok");
  });
});
