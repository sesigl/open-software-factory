import { scenario } from "@opensoftware/testkit";
import { acceptedAdr } from "./repo.ts";

const TOPICS = "process, stack, packages, testing, ports, tools, factory, runs, console, install or design-note";

scenario("SCN-REPO-200", async ({ sut, given, when, then }) => {
  await given('an accepted ADR "0001" without a topic', async () => {
    await sut.files.put("$INPUT/docs/decisions/0001-demo.md", acceptedAdr("0001", "demo 0001", "accepted", ""));
  });

  await given('an accepted ADR "0002" with the topic "dreams"', async () => {
    await sut.files.put("$INPUT/docs/decisions/0002-demo.md", acceptedAdr("0002", "demo 0002", "accepted", "dreams"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ADR"', async () => {
    run = await sut.cli(["check", "ADR"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "ADR docs/decisions/0001-demo.md:1 front matter needs a topic: process, stack, packages, testing, ports, tools, factory, runs, console, install or design-note"',
    async () => {
      expect(run.stdout).toContain(`ADR docs/decisions/0001-demo.md:1 front matter needs a topic: ${TOPICS}`);
    },
  );

  await then(
    `the output contains 'ADR docs/decisions/0002-demo.md:3 topic "dreams" is not process, stack, packages, testing, ports, tools, factory, runs, console, install or design-note'`,
    async () => {
      expect(run.stdout).toContain(`ADR docs/decisions/0002-demo.md:3 topic "dreams" is not ${TOPICS}`);
    },
  );
});
