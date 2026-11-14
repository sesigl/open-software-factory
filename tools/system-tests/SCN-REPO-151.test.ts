import { scenario } from "@opensoftware/testkit";
import { DARK, LIGHT, putStyle, putTokens, tokensFile } from "./design.ts";

scenario("SCN-REPO-151", async ({ sut, given, when, then }) => {
  await given('the console\'s stylesheet "src/web/styles.css" sets its colours and its font with tokens', async () => {
    await putStyle(sut, [
      "body {",
      "  color: var(--osf-text);",
      "  font: var(--osf-size-text) / 1.5 var(--osf-font-sans);",
      "}",
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TOKENS"', async () => {
    run = await sut.cli(["check", "TOKENS"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "TOKENS ok"', async () => {
    expect(run.stdout).toContain("TOKENS ok");
  });
});
