import { scenario } from "@opensoftware/testkit";
import { putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-033", async ({ sut, given, when, then }) => {
  await given('a Git repository with one commit and a Playwright report for "SCN-WEB-001"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout" }]);
    await sut.git.commit("init");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web --commit main"',
    async () => {
      run = await sut.cli([
        "bundle",
        "--playwright",
        "report.json",
        "--repository",
        "https://github.com/acme/web",
        "--commit",
        "main",
      ]);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "evidence.json /subject/commit"', async () => {
    expect(run.stderr).toContain("evidence.json /subject/commit");
  });

  await then('the output folder has no "evidence/evidence.json"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("evidence/evidence.json");
  });
});
