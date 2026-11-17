import { scenario } from "@opensoftware/testkit";
import { putStopCheck } from "./stop-check.ts";

scenario("SCN-FSPEC-134", async ({ sut, given, when, then }) => {
  let providers: string[] = [];
  await given('a factory.yaml that declares the harnesses "claude-code" and "codex"', async () => {
    providers = ["harness:", '  claude-code: "^2"', '  codex: "^1"'];
  });

  await given('its agent "implement" uses the harness "claude-code" and the stop check "make check-fast"', async () => {
    await putStopCheck(sut, "implement", providers);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --harness all"', async () => {
    run = await sut.cli(["render", "--harness", "all"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "codex runs no stop check, so factory render writes none for it"', async () => {
    expect(run.stdout.split("\n")).toContain("codex runs no stop check, so factory render writes none for it");
    expect(run.stdout).not.toContain("claude-code runs no stop check");
  });

  await then('".codex/config.toml" in the output folder does not contain "make check-fast"', async () => {
    expect(await sut.files.read("$OUTPUT/.codex/config.toml")).not.toContain("make check-fast");
  });
});
