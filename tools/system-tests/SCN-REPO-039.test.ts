import { scenario } from "@opensoftware/testkit";
import { RUN_RESOURCE, runRecord } from "./repo.ts";

scenario("SCN-REPO-039", async ({ sut, given, when, then }) => {
  await given('a run record "runs/run-1.jsonl" without the resource attribute "osf.run.id"', async () => {
    const { "osf.run.id": _, ...resource } = RUN_RESOURCE;
    await sut.files.put("$INPUT/runs/run-1.jsonl", runRecord({ resource }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check RUNS"', async () => {
    run = await sut.cli(["check", "RUNS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "RUNS runs/run-1.jsonl:1 does not match the run-record contract"', async () => {
    expect(run.stdout).toContain("RUNS runs/run-1.jsonl:1 does not match the run-record contract");
  });

  await then('the output contains "osf.run.id"', async () => {
    expect(run.stdout).toContain("osf.run.id");
  });
});
