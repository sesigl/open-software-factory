import { scenario } from "@opensoftware/testkit";
import { putTriage } from "./edit.ts";

const BEFORE = "secrets: [ref:env/GH_TOKEN, ref:env/LINEAR_TOKEN]";

scenario("SCN-FSPEC-077", async ({ sut, given, when, then }) => {
  let yaml = "";
  await given(
    'a factory.yaml whose agent "triage" has the line "secrets: [ref:env/GH_TOKEN, ref:env/LINEAR_TOKEN]"',
    async () => {
      yaml = await putTriage(sut, [BEFORE], ["harness:", '  claude-code: "^2"', "secrets:", '  env: "^0"']);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit remove-secret triage ref:env/LINEAR_TOKEN"', async () => {
    run = await sut.cli(["edit", "remove-secret", "triage", "ref:env/LINEAR_TOKEN"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output has the line "secrets: [ref:env/GH_TOKEN]" in place of "secrets: [ref:env/GH_TOKEN, ref:env/LINEAR_TOKEN]"',
    async () => {
      expect(run.stdout).toBe(yaml.replace(BEFORE, "secrets: [ref:env/GH_TOKEN]"));
    },
  );
});
