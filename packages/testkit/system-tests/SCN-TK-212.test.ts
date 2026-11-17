import { scenario } from "@opensoftware/testkit";
import { groupModule, testCases } from "./module.ts";

scenario("SCN-TK-212", async ({ sut, given, when, then }) => {
  const untagged = {
    tags: "",
    steps: ['Given the shared start "profile"'],
    test: [
      "await given('the shared start \"profile\"', async () => {",
      '  await sut.shared("profile", async () => 0);',
      "});",
    ],
  };
  const unused = {
    tags: "@shared=profile",
    steps: ["Then nothing is shared"],
    test: ["await then('nothing is shared', async () => {});"],
  };

  await given(
    'a module whose scenario "SCN-DEMO-001" has no tag @shared and whose test uses the shared start "profile"',
    async () => {
      for (const [path, content] of Object.entries(groupModule([untagged, unused]))) {
        if (!path.endsWith("SCN-DEMO-002.test.ts")) await sut.files.put(path, content);
      }
    },
  );

  await given(
    'whose scenario "SCN-DEMO-002" carries the tag "@shared=profile" and whose test does not use it',
    async () => {
      const path = "$INPUT/system-tests/SCN-DEMO-002.test.ts";
      await sut.files.put(path, groupModule([untagged, unused])[path] as string);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('"report.xml" has the failed test cases "SCN-DEMO-001" and "SCN-DEMO-002"', async () => {
    const cases = testCases(await sut.files.read("$INPUT/report.xml"));
    expect(cases).toContainEqual({ name: "SCN-DEMO-001", failed: true });
    expect(cases).toContainEqual({ name: "SCN-DEMO-002", failed: true });
  });

  await then("the output says 'SCN-DEMO-001 uses sut.shared(\"profile\") but has no tag @shared=profile'", async () => {
    expect(run.stdout + run.stderr).toContain('SCN-DEMO-001 uses sut.shared("profile") but has no tag @shared=profile');
  });

  await then(
    "the output says 'SCN-DEMO-002 has the tag @shared=profile but did not use sut.shared(\"profile\")'",
    async () => {
      expect(run.stdout + run.stderr).toContain(
        'SCN-DEMO-002 has the tag @shared=profile but did not use sut.shared("profile")',
      );
    },
  );
});
