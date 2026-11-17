import { type CliResult, type FakeHttp, scenario } from "@opensoftware/testkit";
import {
  AT_GATE,
  COMPLETE,
  environment,
  foreman,
  gatekeeper,
  github,
  ISSUE,
  intake,
  PULL,
  READY,
  REPOSITORY,
} from "./rehearsal.ts";

/**
 * The signature of the delivery of the issue 7 with the webhook secret of the scenarios, "rehearsal-webhook-secret-1":
 * its body piped to `openssl dgst -sha256 -hmac rehearsal-webhook-secret-1`.
 */
const SIGNATURE = "sha256=cbde6caabc8ccace1ede152b1341224105fd027444bbe3985c4333142fba47fa";

scenario("SCN-REPO-232", async ({ sut, fakes, given, when, then }) => {
  const fake = {} as Record<"github" | "intake" | "foreman" | "gatekeeper", FakeHttp>;
  await given(
    'a fake GitHub API of "acme/scratch" that opens the issue 7 and shows the pull request 8 ready for review',
    async () => {
      fake.github = await github(fakes, [READY]);
    },
  );
  await given('a fake intake whose work item of the issue 7 has the run "run_1"', async () => {
    fake.intake = await intake(fakes);
  });
  await given(
    'a fake foreman whose run "run_1" waits at the gate of the stage "implement" with the pull request 8, and then is complete',
    async () => {
      fake.foreman = await foreman(fakes, [AT_GATE, COMPLETE]);
    },
  );
  await given('a fake gatekeeper whose gate "gate_1" was approved by "github:ada"', async () => {
    fake.gatekeeper = await gatekeeper(fakes);
  });

  let run: CliResult;
  await when('the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal"', async () => {
    run = await sut.cli(["rehearsal", "run", "--repository", REPOSITORY, "--out", "rehearsal"], {
      env: environment(fake),
    });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the fake GitHub API got the issue "Rehearsal: greet(name)" with the labels "factory" and "rehearsal"',
    async () => {
      const issue = fake.github.received().find((request) => request.path === `/repos/${REPOSITORY}/issues`);
      expect(issue?.body).toMatchObject({ title: "Rehearsal: greet(name)", labels: ["factory", "rehearsal"] });
    },
  );

  await then(
    'intake got the "issues" event "labeled" of the issue 7 with the label "factory", signed with the webhook secret',
    async () => {
      const [delivery] = fake.intake.texts().filter((request) => request.path === "/forge/events");
      const [headers] = fake.intake.headers().filter((request) => request.path === "/forge/events");
      expect(JSON.parse(delivery?.text ?? "{}")).toMatchObject({
        action: "labeled",
        label: { name: "factory" },
        issue: { number: 7, html_url: ISSUE, labels: [{ name: "factory" }, { name: "rehearsal" }] },
        repository: { html_url: `https://github.com/${REPOSITORY}` },
      });
      // The HMAC-SHA256 of that body with WEBHOOK_SECRET, as `openssl dgst -sha256 -hmac <secret>` prints it.
      expect(headers?.headers).toMatchObject({ "x-github-event": "issues", "x-hub-signature-256": SIGNATURE });
    },
  );

  await then('the output asks for "/approve" on the pull request 8 by a member of "maintainers"', async () => {
    expect(run.stdout).toContain(
      `The gate before the stage implement waits: comment /approve on ${PULL} as a member of maintainers.`,
    );
  });

  await then(
    '"rehearsal/summary.md" names the issue, the run, each stage with its state, the gate as approved by "github:ada" on GitHub and the pull request as "ready for review"',
    async () => {
      const summary = await sut.files.read("$INPUT/rehearsal/summary.md");
      for (const line of [
        "**Passed:** every stage succeeded.",
        `| Issue | ${ISSUE} |`,
        "| Run | run_1 |",
        "| Gate before implement | approved by github:ada (on GitHub) |",
        `| Pull request | ${PULL} (ready for review) |`,
        ...["triage", "spec", "implement", "review", "verify", "ship"].map((stage) => `| ${stage} | succeeded |  |`),
      ])
        expect(summary.split("\n")).toContain(line);
    },
  );
});
