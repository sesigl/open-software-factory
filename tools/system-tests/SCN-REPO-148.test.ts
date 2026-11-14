import { scenario } from "@opensoftware/testkit";
import { DARK, LIGHT, putStyle, putTokens, tokensFile } from "./design.ts";

scenario("SCN-REPO-148", async ({ sut, given, when, then }) => {
  await given(
    'the tokens file "packages/ui/assets/tokens.css" whose light subtle text is "#8a9099" on the ground "#fafaf9"',
    async () => {
      await putTokens(sut, tokensFile(DARK, { ...LIGHT, "--osf-text-subtle": "#8a9099" }));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check CONTRAST"', async () => {
    run = await sut.cli(["check", "CONTRAST"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "CONTRAST packages/ui/assets/tokens.css:10 --osf-text-subtle on --osf-bg-ground in the light theme has 3.08:1, WCAG 2.2 AA needs 4.5:1"',
    async () => {
      expect(run.stdout).toContain(
        "CONTRAST packages/ui/assets/tokens.css:10 --osf-text-subtle on --osf-bg-ground in the light theme has 3.08:1, WCAG 2.2 AA needs 4.5:1",
      );
    },
  );
});
