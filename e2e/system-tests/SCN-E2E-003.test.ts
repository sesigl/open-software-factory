import { scenario } from "@opensoftware/testkit";
import { factoryYaml, fromContainer, type Smoke, smoke, workFolder } from "./profile.ts";

/** A score of the scorer "research-skill-used" for a run of the triage agent, as scorekit writes it. */
const failed = (run: number) => ({
  id: `research-skill-used-run-${run}`,
  name: "research-skill-used",
  value: 0,
  dataType: "BOOLEAN",
  traceId: run.toString(16).padStart(32, "0"),
  comment: "Investigated inline.",
  timestamp: "2026-01-01T00:00:00Z",
  source: "API",
  metadata: { "osf.run.id": `run-${run}`, "osf.agent": "triage" },
});

/** The model's answer to observer: a change of the factory's AGENTS.md. */
const FIX = {
  solution: "Tell the triage agent to use the research skill.",
  edits: [{ path: "AGENTS.md", old: "Investigate inline.", new: "Use the research skill before you investigate." }],
};

scenario("SCN-E2E-003", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  let profile: Smoke;
  await given('30 recorded runs in which the triage agent failed the scorer "research-skill-used"', async () => {
    await forge.createRepository("factory", { "AGENTS.md": "# Agents\n\nInvestigate inline.\n" });
    const scores = Array.from({ length: 30 }, (_, index) => JSON.stringify(failed(index + 1)));
    const work = await workFolder(sut, { "scores.jsonl": `${scores.join("\n")}\n` });
    const content = JSON.stringify(FIX);
    const model = await fakes.http(
      [{ method: "POST", path: "/v1/chat/completions", body: { choices: [{ message: { role: "assistant", content } }] } }],
      { containers: true },
    );
    profile = await smoke(sut, fakes, factoryYaml(["triage"]), [], forge, {
      E2E_WORK_DIR: work,
      E2E_MODEL_URL: `${model.containerUrl}/v1`,
    });
  });

  await when("the self-improvement loop runs", async () => {
    await profile.run(["run", "--rm", "observer", "analyze", "--out", "problems.json", "scores.jsonl"]);
    const repo = `${fromContainer(forge.url)}/${forge.owner}/factory`;
    await profile.run(["run", "--rm", "observer", "propose", "--repo", repo, "problems.json"]);
  });

  await then("a pull request to the factory repository exists", async () => {
    expect(await forge.pullRequests("factory")).toMatchObject([
      { title: "observer: research-skill-used failed 30 of 30 runs", base: "main", state: "open" },
    ]);
  });

  await then('its description contains the sections "Problem", "Solution" and "Evidence"', async () => {
    const [pr] = await forge.pullRequests("factory");
    expect(pr?.body).toMatch(/^## Problem\n\nThe scorer `research-skill-used` failed 30 of 30 runs/m);
    expect(pr?.body).toMatch(/^## Solution\n\nTell the triage agent to use the research skill\./m);
    expect(pr?.body).toMatch(/^## Evidence\n/m);
  });
});
