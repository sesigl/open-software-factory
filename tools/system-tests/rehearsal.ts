// The fakes of the osf rehearsal scenarios: GitHub's API of the scratch repository "acme/scratch", intake, foreman and
// gatekeeper, each a scripted JSON API on loopback, and the environment that points the command at them.
import type { FakeHttp, Fakes, HttpRoute } from "@opensoftware/testkit";

export const REPOSITORY = "acme/scratch";
export const ISSUE = `https://github.com/${REPOSITORY}/issues/7`;
export const PULL = `https://github.com/${REPOSITORY}/pull/8`;
/** Values of the tests only. */
export const WEBHOOK_SECRET = "rehearsal-webhook-secret-1";
const STAGES = ["triage", "spec", "implement", "review", "verify", "ship"];

/** The stages of the run: those before `at` succeeded, `at` is in `state`, the rest are pending. */
function stages(at: string, state: string, more: Record<string, unknown> = {}) {
  const index = STAGES.indexOf(at);
  return STAGES.map((stage, n) =>
    n < index ? { stage, state: "succeeded" } : n === index ? { stage, state, ...more } : { stage, state: "pending" },
  );
}

export const runAt = (at: string, state: string, more: Record<string, unknown> = {}, run = "blocked") => ({
  runId: "run_1",
  state: run,
  pullRequest: PULL,
  stages: stages(at, state, more),
});

/** The run complete: every stage succeeded, and "implement" keeps the ID of its gate. */
export const COMPLETE = {
  runId: "run_1",
  state: "complete",
  pullRequest: PULL,
  stages: stages("ship", "succeeded").map((stage) =>
    stage.stage === "implement" ? { ...stage, gateId: "gate_1" } : stage,
  ),
};
export const AT_GATE = runAt("implement", "blocked", { gateId: "gate_1" });

/** GitHub's API of the scratch repository: the two labels, the new issue 7, and `more`. */
export const github = (fakes: Fakes, more: HttpRoute[] = []) =>
  fakes.http([
    { method: "POST", path: `/repos/${REPOSITORY}/labels`, status: 201, body: {} },
    {
      method: "POST",
      path: `/repos/${REPOSITORY}/issues`,
      status: 201,
      body: {
        number: 7,
        html_url: ISSUE,
        title: "Rehearsal: greet(name)",
        body: "Add greet(name).",
        user: { login: "ada" },
        updated_at: "2026-01-01T00:00:00Z",
        labels: [{ name: "factory" }, { name: "rehearsal" }],
      },
    },
    ...more,
  ]);

/** The pull request 8 as GitHub's API shows it, ready for review. */
export const READY: HttpRoute = { path: `/repos/${REPOSITORY}/pulls/8`, body: { draft: false, merged: false } };

/** intake: takes the delivery and has the work item of the issue with the run "run_1". */
export const intake = (fakes: Fakes) =>
  fakes.http([
    { method: "POST", path: "/forge/events", body: {} },
    {
      path: `/v1/work-items?dedupeKey=${encodeURIComponent(ISSUE)}`,
      body: { workItem: { id: "wi_1" }, status: "running", runId: "run_1" },
    },
  ]);

/** foreman: the run "run_1" in the views given, each answered twice, the last one from then on. */
export const foreman = (fakes: Fakes, views: unknown[]) =>
  fakes.http(
    views.map((body, index) => ({
      path: "/v1/runs/run_1",
      body,
      ...(index < views.length - 1 ? { times: 2 } : {}),
    })),
  );

/** gatekeeper: the gate "gate_1", approved by "github:ada". */
export const gatekeeper = (fakes: Fakes) =>
  fakes.http([
    {
      path: "/v1/gates/gate_1",
      body: { state: "approved", record: { decision: "approved", decidedBy: { kind: "person", id: "github:ada" } } },
    },
  ]);

/** The environment of osf rehearsal run with the fakes. */
export const environment = (fake: {
  github: FakeHttp;
  intake: FakeHttp;
  foreman: FakeHttp;
  gatekeeper?: FakeHttp;
}) => ({
  REHEARSAL_TOKEN: "github-token-1",
  GITHUB_API_URL: fake.github.url,
  INTAKE_URL: fake.intake.url,
  INTAKE_API_TOKEN: "intake-token-1",
  INTAKE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  FOREMAN_URL: fake.foreman.url,
  FOREMAN_API_TOKEN: "foreman-token-1",
  GATEKEEPER_URL: (fake.gatekeeper ?? fake.foreman).url,
  GATEKEEPER_API_TOKEN: "gatekeeper-token-1",
  REHEARSAL_POLL_MS: "10",
});
