import { scenario } from "@opensoftware/testkit";
import { type Run, runEach } from "./input.ts";

const ARGS: Record<string, string[]> = {
  "verify takes --public-key, like --public-key key.pub": ["record.json"],
  "verify takes one record file": ["--public-key", "gatekeeper.pub", "one.json", "two.json"],
};

scenario("SCN-GATE-087", async ({ sut, when, then }) => {
  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper verify record.json" and "gatekeeper verify --public-key gatekeeper.pub one.json two.json"',
    async () => {
      runs = await runEach(sut, Object.keys(ARGS), (line) => ["verify", ...(ARGS[line] as string[])]);
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2]);
  });

  await then(
    'the error outputs say "verify takes --public-key, like --public-key key.pub" and "verify takes one record file"',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(Object.keys(ARGS).map((line) => `gatekeeper: ${line}\n`));
    },
  );
});
