import type { GateView, RunView, WorkItemList } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import {
  ACCESS,
  api,
  type Browser,
  FOREMAN_TOKEN,
  factoryYaml,
  GATEKEEPER_TOKEN,
  githubSignIn,
  INTAKE_TOKEN,
  runView,
  type Smoke,
  smoke,
  started,
  WORK,
} from "./profile.ts";

// Below Linux's ephemeral range; no other scenario of the suite uses it.
const PORT = "18084";
/** The seed of the console's Ed25519 key, made up for the test as the console's own tests make theirs. */
const SIGNING_KEY = "0123456789abcdef".repeat(4);
/** The person the console signed in, as the fake GitHub names her. */
const GRACE = { kind: "person", id: "grace@acme.dev", displayName: "Grace" };
/** A person that a program names, with no proof. */
const MADE_UP = { kind: "person", id: "varun@acme.dev" };
const NO_PROOF = "send OSF-Person: the console's proof of the person (ADR 0151)";
const STEER = "Export the reports with the CSV writer of the standard library";

scenario("SCN-E2E-010", async ({ sut, fakes, given, when, then }) => {
  let factory = "";
  await given(
    'a factory whose "spec" stage needs approval by the group "maintainers", of which "grace@acme.dev" is a member, and whose agent "implement" waits for a steering message',
    async () => {
      factory = factoryYaml(["spec", "implement"]);
    },
  );

  const github = await githubSignIn(fakes, PORT);
  let profile: Smoke;
  let open: Browser;
  await given(
    'the Compose profile with "CONSOLE_SIGNING_KEY" set, and the console with the sign-in of GitHub, where "grace@acme.dev" of the factory\'s "access.yaml" signed in as "factory-engineer"',
    async () => {
      profile = await smoke(
        sut,
        fakes,
        factory,
        [
          { when: "Write the specification", reply: "spec.md is written" },
          { when: "Implement the work item", waitsFor: STEER, reply: "done" },
        ],
        undefined,
        { ...github.env, CONSOLE_SIGNING_KEY: SIGNING_KEY },
      );
      // gatekeeper matches the person the console proves, the email, against the groups file (ADR 0151).
      await sut.files.put("$INPUT/factory/groups.json", JSON.stringify({ maintainers: [GRACE.id] }));
      await sut.files.put("$INPUT/factory/access.yaml", ACCESS);
      await started(profile, ["foreman", "console"]);
      open = await github.signIn(profile, "/work");
      expect((await open("/work")).html).toContain("grace@acme.dev · factory-engineer");
    },
  );

  let submitted: Awaited<ReturnType<Browser>>;
  let intake = "";
  let foreman = "";
  let gatekeeper = "";
  await when('the factory engineer sends the form "Submit work" of the page "/work"', async () => {
    submitted = await open("/work", { title: WORK.title, type: "idea" });
    [intake, foreman, gatekeeper] = await Promise.all([
      profile.url("intake"),
      profile.url("foreman"),
      profile.url("gatekeeper"),
    ]);
  });

  const inbox = async () => (await api(intake, INTAKE_TOKEN, "/v1/inbox")).body as WorkItemList;
  await then(
    'the console answered 303 to "/work", and intake recorded the work item with "grace@acme.dev" as its requester, named "Grace" as the proof names her',
    async () => {
      expect({ status: submitted.status, location: submitted.location }, submitted.html).toEqual({
        status: 303,
        location: "/work",
      });
      expect((await inbox()).workItems.map((view) => view.workItem.requester)).toEqual([GRACE]);
    },
  );

  let runId = "";
  let gateId = "";
  const stage = async (name: string) => (await runView(foreman, runId)).stages.find((each) => each.stage === name);
  const gate = async () => (await api(gatekeeper, GATEKEEPER_TOKEN, `/v1/gates/${gateId}`)).body as GateView;
  await then('its run waits at the gate of the stage "spec"', async () => {
    await profile.until(async () => Boolean((await inbox()).workItems[0]?.runId), true);
    runId = (await inbox()).workItems[0]?.runId as string;
    await profile.until(async () => (await stage("spec"))?.state, "blocked");
    gateId = (await stage("spec"))?.gateId as string;
    expect((await gate()).state).toBe("pending");
  });

  let refused: { status: number; body: unknown }[] = [];
  await when(
    'a program with the API tokens of intake, foreman and gatekeeper names the made-up person "varun@acme.dev" in a work item, a steering message of the run and an approval of the gate',
    async () => {
      refused = await Promise.all([
        api(intake, INTAKE_TOKEN, "/v1/work-items", {
          method: "POST",
          body: {
            title: "Delete the reports",
            type: "task",
            requester: MADE_UP,
            origin: { source: "api" },
            dedupeKey: "task:delete-the-reports",
          },
        }),
        api(foreman, FOREMAN_TOKEN, `/v1/runs/${runId}/signals`, {
          method: "POST",
          body: { type: "steer", message: STEER, by: MADE_UP },
        }),
        api(gatekeeper, GATEKEEPER_TOKEN, `/v1/gates/${gateId}/decisions`, {
          method: "POST",
          body: { decision: "approved", by: MADE_UP },
        }),
      ]);
    },
  );

  await then(
    'intake, foreman and gatekeeper each answer 401 with "send OSF-Person: the console\'s proof of the person (ADR 0151)"',
    async () => {
      expect(refused.map(({ status, body }) => ({ status, detail: (body as { detail?: string })?.detail }))).toEqual([
        { status: 401, detail: NO_PROOF },
        { status: 401, detail: NO_PROOF },
        { status: 401, detail: NO_PROOF },
      ]);
    },
  );

  await then(
    "nothing changed: intake holds the one work item, the gate is still pending, and the run has no action",
    async () => {
      expect((await inbox()).workItems.map((view) => view.workItem.title)).toEqual([WORK.title]);
      expect((await gate()).state).toBe("pending");
      expect((await runView(foreman, runId)).actions ?? []).toEqual([]);
    },
  );

  let approved: Awaited<ReturnType<Browser>>;
  let steered: Awaited<ReturnType<Browser>>;
  await when(
    'the factory engineer approves the gate on the page of the run, and steers the running stage "implement" there',
    async () => {
      approved = await open(`/runs/${runId}/gates/${gateId}`, { decision: "approved" });
      await profile.until(async () => (await stage("implement"))?.state, "running");
      steered = await open(`/runs/${runId}/signals`, { type: "steer", message: STEER });
    },
  );

  await then('gatekeeper recorded the approval by "grace@acme.dev", named "Grace"', async () => {
    expect({ status: approved.status, location: approved.location }, approved.html).toEqual({
      status: 303,
      location: `/runs/${runId}`,
    });
    expect(await gate()).toMatchObject({ state: "approved", record: { decision: "approved", decidedBy: GRACE } });
  });

  await then(
    'the run recorded the steering message by "grace@acme.dev", and its stage "implement" succeeded',
    async () => {
      expect({ status: steered.status, location: steered.location }, steered.html).toEqual({
        status: 303,
        location: `/runs/${runId}`,
      });
      await profile.until(async () => (await stage("implement"))?.state, "succeeded");
      const view: RunView = await runView(foreman, runId);
      expect(view.actions).toMatchObject([{ type: "steer", message: STEER, by: GRACE }]);
    },
  );
});
