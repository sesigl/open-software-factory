import { testHook } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-021", async ({ given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'an environment with "OSF_TEST_HOOKS" set to "1" and "OSF_NOW" set to "2026-01-01T00:00:00Z"',
    async () => {
      env = { OSF_TEST_HOOKS: "1", OSF_NOW: "2026-01-01T00:00:00Z" };
    },
  );

  let values: (string | undefined)[] = [];
  await when('the module asks testHook for "OSF_NOW" and "OSF_SEED"', async () => {
    values = [testHook(env, "OSF_NOW"), testHook(env, "OSF_SEED")];
  });

  await then('it gives "2026-01-01T00:00:00Z" for "OSF_NOW"', async () => {
    expect(values[0]).toBe("2026-01-01T00:00:00Z");
  });

  await then('it gives no value for "OSF_SEED"', async () => {
    expect(values[1]).toBeUndefined();
  });
});
