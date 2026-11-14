import { scenario } from "@opensoftware/testkit";
import { DARK, LIGHT, putStyle, putTokens, tokensFile } from "./design.ts";

scenario("SCN-REPO-149", async ({ sut, given, when, then }) => {
  await given('the console\'s stylesheet "src/web/styles.css" sets "color: #ff6b1a" on line 2', async () => {
    await putStyle(sut, [".action {", "  color: #ff6b1a;", "}"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TOKENS"', async () => {
    run = await sut.cli(["check", "TOKENS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TOKENS modules/console/src/web/styles.css:2 the colour #ff6b1a is no token: name a token of packages/ui/assets/tokens.css"',
    async () => {
      expect(run.stdout).toContain(
        "TOKENS modules/console/src/web/styles.css:2 the colour #ff6b1a is no token: name a token of packages/ui/assets/tokens.css",
      );
    },
  );
});
