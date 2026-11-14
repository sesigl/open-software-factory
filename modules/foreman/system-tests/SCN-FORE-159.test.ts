import { scenario } from "@opensoftware/testkit";
import { committed, IMPLEMENT, PLAN, readmeFiles, readmeWork, servingCommit } from "./foreman.ts";

scenario("SCN-FORE-159", async ({ sut, fakes, given, when, then }) => {
  // The factory's own repository serves as the declared one: a Git repository the server reaches at a file:// URL.
  let commit = "";
  let url = "";
  let name = "";
  await given('a Git repository with a commit that the server reaches at a "file://" URL', async () => {
    await sut.files.put("$INPUT/notes.md", "one\n");
    await sut.git.commit("the first commit");
    url = `file://${sut.files.path("$INPUT")}`;
    name = sut.files.path("$INPUT").split("/").pop() as string;
  });

  let server: Awaited<ReturnType<typeof servingCommit>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" whose agent "plan" declares that URL in "repositories", with a scripted harness whose "plan" turn prints the log of "repositories/<name>"',
    async () => {
      const factory = (readmeFiles(fakes)["factory.yaml"] as string).replace(
        "    prompt: ./agents/plan.md\n",
        `    prompt: ./agents/plan.md\n    repositories: ["${url}"]\n`,
      );
      commit = await committed(sut, fakes, factory);
      server = await servingCommit(sut, fakes, commit, {
        turns: [
          { when: PLAN, commands: [`git -C repositories/${name} log --format=%H`] },
          { when: IMPLEMENT, reply: "done" },
        ],
      });
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the agent of "plan" found the repository\'s last commit, and only it, in "repositories/<name>" of its folder',
    async () => {
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
      expect(server.harness.commands()).toEqual([expect.objectContaining({ exitCode: 0, output: `${commit}\n` })]);
    },
  );
});
