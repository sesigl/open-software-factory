import { personSigner, SettingError } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { SEED } from "./proof.ts";

scenario("SCN-PPROOF-003", async ({ when, then }) => {
  let failures: unknown[] = [];
  await when(
    'a program makes signers of "", "abc", "<a seed>,<64 times z>", "<a seed>,", "<a seed>0" and "0<a seed>"',
    async () => {
      const settings = ["", "abc", `${SEED},${"z".repeat(64)}`, `${SEED},`, `${SEED}0`, `0${SEED}`];
      failures = await Promise.all(settings.map((setting) => personSigner(setting).catch((error: unknown) => error)));
    },
  );

  await then(
    'each is a SettingError "a signing key is 64 hex digits, the seed of an Ed25519 key: key <n> of <count> is not"',
    async () => {
      for (const error of failures) expect(error).toBeInstanceOf(SettingError);
      const prefix = "a signing key is 64 hex digits, the seed of an Ed25519 key:";
      expect(failures.map((error) => (error as Error).message)).toEqual([
        `${prefix} key 1 of 1 is not`,
        `${prefix} key 1 of 1 is not`,
        `${prefix} key 2 of 2 is not`,
        `${prefix} key 2 of 2 is not`,
        `${prefix} key 1 of 1 is not`,
        `${prefix} key 1 of 1 is not`,
      ]);
      expect((failures[0] as Error).name).toBe("SettingError");
    },
  );

  await then("no message holds the seed", async () => {
    expect(failures.map(String).join("\n")).not.toContain(SEED.slice(0, 16));
  });
});
