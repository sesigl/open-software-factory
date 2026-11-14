import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

// A scenario of the demo module speaks the PostgreSQL protocol over a socket: startup, the password and CREATE TABLE,
// sent at once. It has the answer when PostgreSQL is ready a second time (ReadyForQuery), or when the socket closes.
function demoScenario(id: string, last: string[]): string[] {
  return [
    `scenario("${id}", async ({ fakes, when, then }) => {`,
    "  const url = new URL((await fakes.postgres()).url);",
    "  const typed = (type: string, text: string) => {",
    '    const body = Buffer.from(text, "utf8");',
    "    const head = Buffer.alloc(5);",
    "    head.write(type, 0);",
    "    head.writeInt32BE(body.length + 4, 1);",
    "    return Buffer.concat([head, body]);",
    "  };",
    '  const parameters = Buffer.from(`user\\0${url.username}\\0database\\0${url.pathname.slice(1)}\\0\\0`, "utf8");',
    "  const startup = Buffer.alloc(8);",
    "  startup.writeInt32BE(parameters.length + 8, 0);",
    "  startup.writeInt32BE(196608, 4);",
    '  let answer = "";',
    "  await when('the test creates the table \"notes\"', async () => {",
    '    const socket = connect(Number(url.port), "127.0.0.1");',
    "    await new Promise<void>((resolve) => {",
    "      socket.on('error', () => resolve());",
    "      socket.on('close', () => resolve());",
    "      socket.on('data', (data: Buffer) => {",
    '        answer += data.toString("latin1");',
    '        if (answer.split("Z\\0\\0\\0\\x05").length > 2) resolve();',
    "      });",
    "      socket.write(",
    "        Buffer.concat([startup, parameters, typed('p', `${url.password}\\0`), typed('Q', 'CREATE TABLE notes (id int)\\0')]),",
    "      );",
    "    });",
    "    socket.destroy();",
    "  });",
    "  await then('the answer is \"CREATE TABLE\"', async () => {",
    '    expect(answer).toContain("CREATE TABLE\\0");',
    ...last.map((line) => `    ${line}`),
    "  });",
    "});",
  ];
}

scenario("SCN-TK-152", async ({ sut, given, when, then }) => {
  let first: string[] = [];
  await given(
    'a module whose two scenarios in one test file each create the table "notes" in fakes.postgres and expect the answer "CREATE TABLE"',
    async () => {
      first = demoScenario("SCN-DEMO-001", []);
    },
  );

  await given('its second scenario expects one container with the label "org.opensoftware.run=r8"', async () => {
    const steps = ['    When the test creates the table "notes"', '    Then the answer is "CREATE TABLE"'];
    const module = {
      ...demoModule(),
      "$INPUT/features/a.feature": [
        "Feature: Demo",
        "",
        ...["SCN-DEMO-001", "SCN-DEMO-002"].flatMap((id) => [
          `  @id=${id} @status=implemented`,
          `  Scenario: Demo ${id}`,
          ...steps,
          "",
        ]),
      ].join("\n"),
      "$INPUT/system-tests/SCN-DEMO-001.test.ts": [
        'import { execFileSync } from "node:child_process";',
        'import { connect } from "node:net";',
        'import { scenario } from "@opensoftware/testkit";',
        "",
        ...first,
        ...demoScenario("SCN-DEMO-002", [
          'const found = execFileSync("docker", ["ps", "--quiet", "--filter", "label=org.opensoftware.run=r8"], {',
          '  encoding: "utf8",',
          "});",
          "expect(found.trim().split(/\\s+/)).toHaveLength(1);",
        ]),
        "",
      ].join("\n"),
    };
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" with OSF_TESTKIT_RUN "r8" in the module',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], { env: { OSF_TESTKIT_RUN: "r8" } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"', async () => {
    const cases = testCases(await sut.files.read("$INPUT/report.xml"));
    expect(cases).toContainEqual({ name: "SCN-DEMO-001", failed: false });
    expect(cases).toContainEqual({ name: "SCN-DEMO-002", failed: false });
  });
});
