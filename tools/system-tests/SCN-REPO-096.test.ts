import { scenario } from "@opensoftware/testkit";

const report = (status: string, line: number) =>
  JSON.stringify({
    schemaVersion: "1",
    files: {
      "src/run.ts": {
        language: "typescript",
        source: "",
        mutants: [
          { id: String(line), mutatorName: "BooleanLiteral", status, location: { start: { line, column: 1 } } },
        ],
      },
    },
  });

scenario("SCN-REPO-096", async ({ sut, given, when, then }) => {
  await given(
    'a plan with the shards "1/2" and "2/2" of "modules/demo" with the guard "aaaa" and of "modules/other" with the guard "bbbb"',
    async () => {
      const plan = ["modules/demo", "modules/other"].flatMap((folder) =>
        ["1/2", "2/2"].map((shard) => ({ folder, shard, guard: folder === "modules/demo" ? "aaaa" : "bbbb" })),
      );
      await sut.files.put("$INPUT/plan.json", JSON.stringify(plan));
    },
  );

  await given(
    'a report of shard 1 of "modules/demo" with a killed mutant, a report of its shard 2 with a survived mutant, and a report of shard 1 of "modules/other"',
    async () => {
      await sut.files.put("$INPUT/reports/mutation/modules-demo.shard-1.json", report("Killed", 4));
      await sut.files.put("$INPUT/reports/mutation/modules-demo.shard-2.json", report("Survived", 5));
      await sut.files.put("$INPUT/reports/mutation/modules-other.shard-1.json", report("Killed", 1));
    },
  );

  await given(
    'the results file "modules-demo.cccc.json" of an earlier guard in "reports/mutation-incremental"',
    async () => {
      await sut.files.put("$INPUT/reports/mutation-incremental/modules-demo.cccc.json", report("Killed", 9));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf mutation-merge plan.json reports/mutation-incremental"', async () => {
    run = await sut.cli(["mutation-merge", "plan.json", "reports/mutation-incremental"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"reports/mutation-incremental" holds only "modules-demo.aaaa.json", with the killed and the survived mutant',
    async () => {
      expect(await sut.files.list("$INPUT/reports/mutation-incremental")).toEqual(["modules-demo.aaaa.json"]);
      const merged = JSON.parse(await sut.files.read("$INPUT/reports/mutation-incremental/modules-demo.aaaa.json"));
      const statuses = merged.files["src/run.ts"].mutants.map((mutant: { status: string }) => mutant.status);
      expect(statuses).toEqual(["Killed", "Survived"]);
    },
  );
});
