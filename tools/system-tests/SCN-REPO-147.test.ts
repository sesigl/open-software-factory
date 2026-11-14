import { scenario } from "@opensoftware/testkit";
import { DARK, LIGHT, putStyle, putTokens, tokensFile } from "./design.ts";

scenario("SCN-REPO-147", async ({ sut, given, when, then }) => {
  await given(
    'the tokens file "packages/ui/assets/tokens.css" with a ground, a text and a subtle text for each theme',
    async () => {
      await putTokens(sut, tokensFile(DARK, LIGHT));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check CONTRAST"', async () => {
    run = await sut.cli(["check", "CONTRAST"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "CONTRAST ok"', async () => {
    expect(run.stdout).toContain("CONTRAST ok");
  });
});
