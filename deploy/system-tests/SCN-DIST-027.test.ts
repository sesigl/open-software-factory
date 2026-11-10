import { scenario } from "@opensoftware/testkit";
import { profile } from "./profile.ts";

/** BerriAI's enterprise code: the folder of its source and the package that LiteLLM imports when it is there. */
const LOOK = [
  "import importlib.util, os",
  "found = [p for p in ['/app/enterprise'] if os.path.exists(p)]",
  "found += ['litellm_enterprise'] if importlib.util.find_spec('litellm_enterprise') else []",
  "print(found or 'no enterprise code')",
].join("\n");

scenario("SCN-DIST-027", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let run: Awaited<ReturnType<typeof compose.run>>;
  await when(
    'the operator runs "docker compose run --rm --no-deps" in the service "litellm" to look for LiteLLM\'s enterprise code',
    async () => {
      run = await compose.run(["run", "--rm", "--no-deps", "--entrypoint", "python", "litellm", "-c", LOOK]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "no enterprise code"', async () => {
    expect(run.stdout.trim()).toBe("no enterprise code");
  });
});
