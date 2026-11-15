import { personChecker, SettingError } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-PPROOF-004", async ({ when, then }) => {
  let failures: unknown[] = [];
  let made: unknown;
  await when(
    'a program makes checkers of "", "console", "Console=http://console/keys", "con_sole=http://console/keys", "console=ftp://console/keys", "console=xhttp://console/keys" and "console=http://console/keys,=http://other/keys"',
    async () => {
      const settings = [
        "",
        "console",
        "Console=http://console/keys",
        "con_sole=http://console/keys",
        "console=ftp://console/keys",
        "console=xhttp://console/keys",
        "console=http://console/keys,=http://other/keys",
      ];
      // An async function gives what personChecker throws as its rejection.
      const checkers = settings.map(async (setting) => personChecker(setting, { audience: "foreman" }));
      failures = await Promise.all(checkers.map((checker) => checker.catch((error: unknown) => error)));
    },
  );

  await when(
    'a program makes a checker of "console=https://console/keys, acme-portal=http://portal/keys"',
    async () => {
      made = personChecker("console=https://console/keys, acme-portal=http://portal/keys", { audience: "foreman" });
    },
  );

  await then(
    'each of the first is a SettingError "a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "<pair>" is not"',
    async () => {
      for (const error of failures) expect(error).toBeInstanceOf(SettingError);
      const prefix = "a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json:";
      expect(failures.map((error) => (error as Error).message)).toEqual([
        `${prefix} "" is not`,
        `${prefix} "console" is not`,
        `${prefix} "Console=http://console/keys" is not`,
        `${prefix} "con_sole=http://console/keys" is not`,
        `${prefix} "console=ftp://console/keys" is not`,
        `${prefix} "console=xhttp://console/keys" is not`,
        `${prefix} "=http://other/keys" is not`,
      ]);
    },
  );

  await then("the last gives a checker", async () => {
    expect(made).toHaveProperty("check");
  });
});
