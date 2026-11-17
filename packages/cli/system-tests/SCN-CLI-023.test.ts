import { testHook } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-023", async ({ given, when, then }) => {
  let envs: Record<string, string>[] = [];
  await given(
    'an environment without "OSF_TEST_HOOKS", once without "OSF_NOW" and once with "OSF_NOW" set to ""',
    async () => {
      envs = [{}, { OSF_NOW: "" }];
    },
  );

  let values: (string | undefined)[] = [];
  await when('the module asks testHook for "OSF_NOW" in each environment', async () => {
    values = envs.map((env) => testHook(env, "OSF_NOW"));
  });

  await then("it gives no value in each environment", async () => {
    expect(values).toEqual([undefined, undefined]);
  });
});
