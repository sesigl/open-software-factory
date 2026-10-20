import { scenario } from "@opensoftware/testkit";
import { runsOf } from "./otlp.ts";
import { readmeSession } from "./sessions.ts";

scenario("SCN-RUN-001", async ({ sut, fakes, given, when, then }) => {
  await given("a Git repository with one commit and the sample Claude Code session from the README", async () => {
    const readme = fakes.fromRepository("modules/runlog")["README.md"] as string;
    await sut.files.put("$INPUT/session.jsonl", readmeSession(readme));
    await sut.git.commit("init");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs());
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });

  await then(
    'the run in "runs.jsonl" has the root span "invoke_agent" with "gen_ai.conversation.id" "0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.name).toBe("invoke_agent");
      expect(exported?.root.attributes["gen_ai.conversation.id"]).toBe("0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5");
    },
  );
});
