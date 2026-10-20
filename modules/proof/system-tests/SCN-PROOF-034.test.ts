import { scenario } from "@opensoftware/testkit";
import { PR, SHA } from "./reports.ts";

scenario("SCN-PROOF-034", async ({ sut, given, when, then }) => {
  await given('a bundle whose manifest has the scenario ID "WEB-1"', async () => {
    await sut.files.put(
      "$INPUT/evidence/evidence.json",
      JSON.stringify({
        manifestVersion: 1,
        id: "proof-1",
        createdAt: "2026-01-01T00:00:00Z",
        subject: { repository: "https://github.com/acme/web", commit: SHA },
        producer: { name: "proof", version: "0.1.0" },
        result: "passed",
        scenarios: [{ id: "WEB-1", result: "passed", artifacts: [] }],
        artifacts: [],
      }),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence --pr https://github.com/acme/web/pull/7" with PROOF_FORGE_TOKEN',
    async () => {
      run = await sut.cli(["attach", "evidence", "--pr", PR], { env: { PROOF_FORGE_TOKEN: "test-token" } });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "evidence.json /scenarios/0/id"', async () => {
    expect(run.stderr).toContain("evidence.json /scenarios/0/id");
  });
});
