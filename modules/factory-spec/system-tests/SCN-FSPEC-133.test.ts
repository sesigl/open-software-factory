import { scenario } from "@opensoftware/testkit";
import { putStopCheck, stopCommands } from "./stop-check.ts";

// Claude Code runs the command in the project's folder with the hook's input as JSON on stdin. Code 2 blocks the stop
// and hands the error output to the agent; "stop_hook_active" is true when a Stop hook already blocked this stop.
const SKIP_SECOND_STOP = `grep -Eq '"stop_hook_active": *true' && exit 0`;
const SKIP_CLEAN_TREE = `[ -z "$(git status --porcelain)" ] && exit 0`;
const CHECK =
  "{ make check-fast; } >&2 || { echo 'the stop check failed: fix it before you report done, or stop and ask' >&2; exit 2; }";

scenario("SCN-FSPEC-133", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" uses the harness "claude-code" and the stop check "make check-fast"',
    async () => {
      await putStopCheck(sut, "implement");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  let parts: string[] = [];
  await then(
    'the Stop hook in ".claude/settings.json" exits with code 0 when its input has "stop_hook_active" true',
    async () => {
      const commands = await stopCommands(sut);
      expect(commands).toHaveLength(1);
      parts = (commands[0] as string).split("; ");
      expect(parts[0]).toBe(SKIP_SECOND_STOP);
    },
  );

  await then('it exits with code 0 when "git status --porcelain" prints nothing', async () => {
    expect(parts[1]).toBe(SKIP_CLEAN_TREE);
  });

  await then(
    'it runs "make check-fast" with its output on the error output, and exits with code 2 and "the stop check failed: fix it before you report done, or stop and ask" when that fails',
    async () => {
      expect(parts.slice(2).join("; ")).toBe(CHECK);
    },
  );
});
