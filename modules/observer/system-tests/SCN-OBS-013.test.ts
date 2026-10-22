import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import { factoryRepository, modelAnswering, propose, RESEARCH_FIX, writeProblems } from "./factory.ts";

scenario("SCN-OBS-013", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given('a Forgejo repository "tester/factory" whose "AGENTS.md" says "Investigate inline."', async () => {
    forge = await factoryRepository(fakes);
  });
  await given(
    '"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs, the first of them "run-1" with the reason "Investigated inline." and the transcript "https://langfuse.example/trace/1"',
    () => writeProblems(sut),
  );

  let gateway: ModelGateway;
  await given(
    'the model gateway answers a prompt with "Investigated inline." with the solution "Tell the triage agent to use the research skill." and an edit of "AGENTS.md" from "Investigate inline." to "Use the research skill before you investigate."',
    async () => {
      gateway = await modelAnswering(fakes, RESEARCH_FIX, true);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer propose --repo <forge URL>/tester/factory problems.json"', async () => {
    run = await propose(sut, forge, gateway);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  const body = async () => (await forge.pullRequests("factory"))[0]?.body ?? "";
  await then(
    'the repository has one open pull request with the title "observer: research-skill-used failed 30 of 40 runs"',
    async () => {
      expect(await forge.pullRequests("factory")).toMatchObject([
        { title: "observer: research-skill-used failed 30 of 40 runs", state: "open" },
      ]);
    },
  );

  await then('its description has the sections "Problem", "Solution" and "Evidence"', async () => {
    const text = await body();
    expect(text).toMatch(/^## Problem\n\nThe scorer `research-skill-used` failed 30 of 40 runs \(75\.0%\)\./m);
    expect(text).toMatch(/^## Solution\n\nTell the triage agent to use the research skill\.\n\n- `AGENTS\.md`$/m);
    expect(text).toMatch(/^## Evidence$/m);
    expect(text).toContain("- and 10 more failed runs");
    expect(text).toContain("observer check --problem research-skill-used --pull-request");
  });

  await then(
    'its Evidence section names the run "run-1" with "Investigated inline." and "https://langfuse.example/trace/1"',
    async () => {
      expect(await body()).toContain(
        "- run-1 (2026-01-01T00:00:00.000Z): Investigated inline. https://langfuse.example/trace/1",
      );
      expect(gateway.calls[0]?.body).toContain("Investigate inline.");
    },
  );

  await then("the output names the URL of the pull request", async () => {
    const [pr] = await forge.pullRequests("factory");
    expect(run.stdout).toContain(`opened ${pr?.url}`);
    expect(JSON.parse(await sut.files.read("$OUTPUT/proposal.json"))).toMatchObject({ pullRequest: pr?.url });
  });
});
