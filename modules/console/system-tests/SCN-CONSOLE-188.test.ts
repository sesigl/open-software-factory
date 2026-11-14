import { type CliResult, type Page, scenario } from "@opensoftware/testkit";
import { rows, serving } from "./console.ts";
import { doctorEnv, VALUE } from "./secrets.ts";

/** The advice of the warning, with the time the token ends. */
const WARNING =
  /^WARN {2}secrets token: the token in OSF_OPENBAO_TOKEN ends at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z, within 7 days: give the console a new token$/;

scenario("SCN-CONSOLE-188", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", a store with it, and a console\'s token that lives 72 hours',
    async () => {
      const setup = await doctorEnv(sut, fakes, { triage: { secrets: ["ref:openbao/linear-token"] } }, { ttl: "72h" });
      await setup.bao.write("linear-token", { value: VALUE });
      env = setup.env;
    },
  );

  let run: CliResult;
  let health: Page;
  await when('the user runs "console doctor" and a person opens "/health"', async () => {
    run = await sut.cli(["doctor"], { env });
    await serving(sut, [env.CONSOLE_FOREMAN_URL as string], env);
    health = await sut.pages.open("/health");
  });

  const warning = () => run.stdout.split("\n").find((line) => line.startsWith("WARN  ")) ?? "";

  await then(
    'the command exits with code 0 and prints "WARN  secrets token: the token in OSF_OPENBAO_TOKEN ends at <time>, within 7 days: give the console a new token"',
    async () => {
      expect(run.exitCode, run.stdout + run.stderr).toBe(0);
      expect(warning()).toMatch(WARNING);
    },
  );

  await then('its last line is "all 5 checks ok, 1 warns"', async () => {
    expect(run.stdout.split("\n").at(-2)).toBe("all 5 checks ok, 1 warns");
  });

  await then('"/health" answers 200 with the row "secrets token", "warning" and the same advice', async () => {
    expect(health.status).toBe(200);
    expect(rows(health).find(([name]) => name === "secrets token")).toEqual([
      "secrets token",
      "warning",
      warning().replace("WARN  secrets token: ", ""),
    ]);
  });
});
