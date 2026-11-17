import { scenario } from "@opensoftware/testkit";
import { lines, mergedFrom, readReport } from "./records.ts";

scenario("SCN-LEDGER-067", async ({ sut, given, when, then }) => {
  const events: unknown[] = [];
  await given(
    'merged pull requests from the head branches "osf/run-01", "observer/tune-skill-1a2b3c4d", "factory/12-add-cart", "fix-login" and "add-sum"',
    async () => {
      events.push(
        ...mergedFrom(1, "osf/run-01"),
        ...mergedFrom(2, "observer/tune-skill-1a2b3c4d"),
        ...mergedFrom(3, "factory/12-add-cart"),
        ...mergedFrom(4, "fix-login"),
        ...mergedFrom(5, "add-sum", { title: "Add the sum" }),
      );
    },
  );

  await given(
    `a merged pull request 'Revert "Add the sum"' from the head branch "revert-5-add-sum" that reverts the one from "add-sum"`,
    async () => {
      events.push(...mergedFrom(6, "revert-5-add-sum", { title: 'Revert "Add the sum"', at: "2026-01-07T10:00:00Z" }));
      await sut.files.put("$INPUT/data.jsonl", lines(...events));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report data.jsonl"', async () => {
    run = await sut.cli(["report", "data.jsonl"]);
  });

  await then(
    '"report.json" shows 3 merged pull requests of the factory and 3 of people, each a share of 0.5',
    async () => {
      const { origin } = await readReport(sut);
      expect(origin.factory).toMatchObject({ merged: 3, share: 0.5 });
      expect(origin.people).toMatchObject({ merged: 3, share: 0.5 });
    },
  );

  await then('"report.json" shows the revert rate 0 for the factory and 0.3333 for people', async () => {
    const { origin } = await readReport(sut);
    expect(origin.factory).toMatchObject({ reverts: 0, revertRate: 0 });
    expect(origin.people).toMatchObject({ reverts: 1, revertRate: 0.3333 });
  });

  await then(
    'the output says "merged pull requests 6, factory share 50.0%, revert rate of the factory 0.0% and of people 33.3%"',
    async () => {
      expect(run.stdout).toContain(
        "merged pull requests 6, factory share 50.0%, revert rate of the factory 0.0% and of people 33.3%",
      );
    },
  );
});
