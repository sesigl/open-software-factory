import { scenario } from "@opensoftware/testkit";
import { putStopCheck, settings, stopCommands } from "./stop-check.ts";

const HAND_WRITTEN = { hooks: [{ type: "command", command: "make lint" }] };

scenario("SCN-FSPEC-132", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" uses the harness "claude-code" and the stop check "make check-fast"',
    async () => {
      await putStopCheck(sut, "implement");
    },
  );

  await given(
    '".claude/settings.json" in the output folder allows "Bash(make check)" and has a hand-written Stop hook',
    async () => {
      const hand = { permissions: { allow: ["Bash(make check)"] }, hooks: { Stop: [HAND_WRITTEN] } };
      await sut.files.put("$OUTPUT/.claude/settings.json", `${JSON.stringify(hand, null, 2)}\n`);
    },
  );

  let first: Awaited<ReturnType<typeof sut.cli>>;
  let second: Awaited<ReturnType<typeof sut.cli>>;
  let written = "";
  await when('the factory engineer runs "factory render" twice', async () => {
    first = await sut.cli(["render"]);
    written = await sut.files.read("$OUTPUT/.claude/settings.json");
    second = await sut.cli(["render"]);
  });

  await then('both commands exit with code 0 and print "wrote .claude/settings.json"', async () => {
    expect(first.exitCode, first.stdout + first.stderr).toBe(0);
    expect(second.exitCode, second.stdout + second.stderr).toBe(0);
    expect(first.stdout.split("\n")).toContain("wrote .claude/settings.json");
    expect(second.stdout.split("\n")).toContain("wrote .claude/settings.json");
  });

  await then('".claude/settings.json" in the output folder still allows "Bash(make check)"', async () => {
    expect((await settings(sut)).permissions).toEqual({ allow: ["Bash(make check)"] });
  });

  await then(
    'its "Stop" hooks are one command hook that runs "make check-fast", in place of the hand-written one',
    async () => {
      const stop = (await settings(sut)).hooks?.Stop ?? [];
      expect(stop).toHaveLength(1);
      expect(stop[0]?.hooks).toHaveLength(1);
      expect(stop[0]?.hooks[0]?.type).toBe("command");
      const [command] = await stopCommands(sut);
      expect(command).toContain("{ make check-fast; }");
      expect(command).not.toContain("make lint");
    },
  );

  await then('the second render wrote the same ".claude/settings.json" as the first', async () => {
    expect(await sut.files.read("$OUTPUT/.claude/settings.json")).toBe(written);
  });
});
