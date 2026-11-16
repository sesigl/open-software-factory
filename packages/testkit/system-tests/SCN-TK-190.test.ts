import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-190", async ({ sut, given, when, then }) => {
  await given(
    'a module whose system test puts "$INPUT/a.txt" with the mode 0640, expects sut.files.mode of it to be 0640, and expects 0600 after its program narrows it',
    async () => {
      const module = demoModule({
        bin: 'import { chmodSync } from "node:fs";\nchmodSync(`${process.env.INPUT}/a.txt`, 0o600);\n',
        steps: [
          'Given the file "a.txt" with the mode 0640',
          'When the user runs "demo"',
          "Then its mode was 0640 and is 0600",
        ],
        test: [
          "let before = 0;",
          "await given('the file \"a.txt\" with the mode 0640', async () => {",
          '  await sut.files.put("$INPUT/a.txt", "a", { mode: 0o640 });',
          '  before = await sut.files.mode("$INPUT/a.txt");',
          "});",
          "await when('the user runs \"demo\"', async () => {",
          "  await sut.cli([]);",
          "});",
          "await then('its mode was 0640 and is 0600', async () => {",
          '  expect([before, await sut.files.mode("$INPUT/a.txt")]).toEqual([0o640, 0o600]);',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
