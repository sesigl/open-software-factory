import type { GateView, RunView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import {
  api,
  FOREMAN_TOKEN,
  factoryYaml,
  GATEKEEPER_TOKEN,
  GATES,
  MAINTAINER,
  type Smoke,
  smoke,
  started,
  WORK,
} from "./profile.ts";

scenario("SCN-E2E-002", async ({ sut, fakes, given, when, then }) => {
  let profile: Smoke;
  await given('a factory whose "spec" stage needs approval by the group "maintainers"', async () => {
    profile = await smoke(sut, fakes, factoryYaml(["spec", "implement"]), [
      { when: "Write the specification", reply: "spec.md is written" },
      { when: "Implement the work item", reply: "done" },
    ]);
    await started(profile, ["foreman"]);
  });

  let foreman = "";
  let runId = "";
  const run = async () => (await api(foreman, FOREMAN_TOKEN, `/v1/runs/${runId}`)).body as RunView;
  const stage = async (name: string) => (await run()).stages.find((candidate) => candidate.stage === name);
  await given('work waits at the "spec" gate with an approval request in the fake Slack channel', async () => {
    foreman = await profile.url("foreman");
    const answer = await api(foreman, FOREMAN_TOKEN, "/v1/runs", { method: "POST", body: WORK });
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
    runId = (answer.body as RunView).runId;
    await profile.until(async () => (await stage("spec"))?.state, "blocked");
    const buttons = () => profile.slack.messages(GATES).flatMap((message) => message.buttons.map(({ text }) => text));
    await profile.until(buttons, ["Approve", "Reject"]);
  });

  await when('a member of "maintainers" approves the request', async () => {
    const [request] = profile.slack.messages(GATES);
    await profile.slack.press({ channel: GATES, ts: request?.ts as string, actionId: "Approve", user: MAINTAINER });
  });

  await then('the work moves to the "implement" stage', async () => {
    await profile.until(async () => (await stage("implement"))?.state, "succeeded");
    expect(profile.harness.prompts().map((prompt) => prompt.split("\n")[0])).toEqual([
      "Write the specification of the work item.",
      "Implement the work item on a new branch, push it and open a pull request. End with its link.",
    ]);
  });

  await then("the approval record names the approver and the time", async () => {
    const gate = (await stage("spec"))?.gateId as string;
    const view = (await api(await profile.url("gatekeeper"), GATEKEEPER_TOKEN, `/v1/gates/${gate}`)).body as GateView;
    expect(view).toMatchObject({
      state: "approved",
      record: {
        decision: "approved",
        decidedBy: { kind: "person", id: `slack:${MAINTAINER}` },
        // The press's time on the fixed clock of the scenario, to the microsecond of Slack's message time.
        decidedAt: expect.stringMatching(/^2026-01-01T00:00:00\.\d{6}Z$/),
      },
    });
  });
});
