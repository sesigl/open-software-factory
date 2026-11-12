import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

/** Each status and conclusion of a GitHub check run, and the state pr prints for it. */
const RUNS: [run: { status?: string; conclusion?: string }, state: string][] = [
  [{ conclusion: "success" }, "success"],
  [{ conclusion: "neutral" }, "success"],
  [{ conclusion: "skipped" }, "success"],
  [{ conclusion: "failure" }, "failure"],
  [{ conclusion: "timed_out" }, "error"],
  [{ conclusion: "cancelled" }, "error"],
  [{ conclusion: "action_required" }, "error"],
  [{ conclusion: "stale" }, "error"],
  [{ conclusion: "startup_failure" }, "error"],
  [{ status: "queued" }, "pending"],
  [{ status: "in_progress" }, "pending"],
];
const nameOf = (run: { status?: string; conclusion?: string }) => run.conclusion ?? run.status ?? "";

scenario("SCN-FGITHUB-005", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" whose head commit has one check run for each status and conclusion of GitHub',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      for (const [run] of RUNS)
        await box.forge.checkRun(pr, { ...run, name: nameOf(run), title: `${nameOf(run)} run` });
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then(
    'pr lists "success" for success, neutral and skipped, "failure" for failure, "error" for timed_out, cancelled, action_required, stale and startup_failure, and "pending" for queued and in_progress',
    async () => {
      const checks = printed.checks as { name: string; url: string }[];
      expect(checks).toEqual(
        RUNS.map(([run, state], index) => ({
          name: nameOf(run),
          state,
          description: `${nameOf(run)} run`,
          url: checks[index]?.url,
        })),
      );
      expect(checks[0]?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/tester\/web\/runs\/\d+$/);
    },
  );
});
