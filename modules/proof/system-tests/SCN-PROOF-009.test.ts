import { scenario } from "@opensoftware/testkit";
import { playwrightReport, screenshot } from "./reports.ts";

scenario("SCN-PROOF-009", async ({ sut, given, when, then }) => {
  await given(
    'a Playwright report whose test "SCN-WEB-001 checkout" has the screenshot "missing.png" that does not exist',
    async () => {
      await sut.files.put(
        "$INPUT/report.json",
        playwrightReport([{ title: "SCN-WEB-001 checkout", attachments: [screenshot("missing.png")] }]),
      );
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "missing.png does not exist"', async () => {
    expect(run.stderr).toContain("missing.png does not exist");
  });

  await then('the output folder has no "evidence/evidence.json"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("evidence/evidence.json");
  });
});
