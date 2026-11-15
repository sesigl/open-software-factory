import { type Forge, scenario } from "@opensoftware/testkit";
import { profile } from "./profile.ts";

const REPOSITORY = "tester/factory";
const GROUPS = '{"maintainers": ["slack:U0OPERATOR"]}\n';

/** Calls Forgejo's API on the repository as its owner, as a person would. */
async function api(forge: Forge, method: string, path: string, body?: unknown): Promise<unknown> {
  const answer = await fetch(`${forge.url}/api/v1/repos/${REPOSITORY}${path}`, {
    method,
    headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`the forge answered ${method} ${path} with ${answer.status}`);
  return answer.json();
}

/** The head commit of "main". */
const mainOf = async (forge: Forge) => (await forge.branches("factory")).find((branch) => branch.name === "main")?.sha;

scenario("SCN-DIST-043", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let url = "";
  await given(
    'a private repository "tester/factory" on the forge with the reference factory, which the containers reach as "host.docker.internal"',
    async () => {
      forge = await fakes.forge();
      const files = fakes.fromRepository("deploy/compose/factory");
      await forge.createRepository("factory", { ...files });
      await api(forge, "PATCH", "", { private: true });
      // Docker Desktop knows the name; Linux needs it mapped to the host.
      url = `${forge.url.replace(/\/\/(localhost|127\.0\.0\.1):/, "//host.docker.internal:")}/${REPOSITORY}.git`;
      await sut.files.put(
        "$INPUT/forge.yaml",
        ["services:", "  factory-repo:", '    extra_hosts: ["host.docker.internal:host-gateway"]', ""].join("\n"),
      );
    },
  );

  let compose: Awaited<ReturnType<typeof profile>>;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", "FACTORY_REPOSITORY" set to "git+<the forge>/tester/factory.git#main" and "FACTORY_TOKEN" to a token of the forge',
    async () => {
      compose = await profile(sut, undefined, { FACTORY_REPOSITORY: `git+${url}#main`, FACTORY_TOKEN: forge.token });
    },
  );

  const override = () => ["--file", sut.files.path("$INPUT/forge.yaml")];
  /** A shell script in the volume "factory", in the image of the tools, without running factory-repo first. */
  const inVolume = (script: string) =>
    compose.run(["run", "--rm", "--no-deps", "-T", "--entrypoint", "sh", "factory", "-c", script]);
  const head = async () => (await inVolume("git -C /factory rev-parse HEAD")).stdout.trim();
  /** "docker compose run --rm factory-repo", with the options `more` of "run". */
  const factoryRepo = (more: string[] = []) => compose.run([...override(), "run", "--rm", ...more, "factory-repo"]);

  let run: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose run --rm factory-repo"', async () => {
    run = await factoryRepo();
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the volume "factory" holds the newest commit of "main" with the repository\'s "factory.yaml" and "policy/spec.rego"',
    async () => {
      expect(await head()).toBe(await mainOf(forge));
      const files = await inVolume("cat /factory/factory.yaml /factory/policy/spec.rego");
      const both = [
        await forge.file("factory", "factory.yaml", "main"),
        await forge.file("factory", "policy/spec.rego", "main"),
      ];
      expect(files.stdout).toBe(both.join(""));
    },
  );

  await then('no file of the volume "factory" holds the token', async () => {
    const found = await inVolume(`grep -rl '${forge.token}' /factory`);
    // grep exits with 1 when no file holds it.
    expect({ exitCode: found.exitCode, files: found.stdout }).toEqual({ exitCode: 1, files: "" });
  });

  let commit: string | undefined;
  await when(
    'a person commits a new "groups.json" on "main" and the operator runs "docker compose run --rm factory-repo" again',
    async () => {
      const known = (await api(forge, "GET", "/contents/groups.json?ref=main")) as { sha: string };
      const content = Buffer.from(GROUPS).toString("base64");
      await api(forge, "PUT", "/contents/groups.json", { branch: "main", sha: known.sha, content, message: "groups" });
      commit = await mainOf(forge);
      run = await factoryRepo();
      expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    },
  );

  await then('the volume "factory" holds that commit and its "groups.json"', async () => {
    expect(await head()).toBe(commit);
    expect((await inVolume("cat /factory/groups.json")).stdout).toBe(GROUPS);
  });

  await when('the operator runs "docker compose run --rm factory-repo" with an empty "FACTORY_TOKEN"', async () => {
    run = await factoryRepo(["-e", "FACTORY_TOKEN="]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "factory-repo: cannot clone main of <the forge>/tester/factory.git" and "check FACTORY_REPOSITORY and FACTORY_TOKEN"',
    async () => {
      expect(run.stderr).toContain(`factory-repo: cannot clone main of ${url}: `);
      expect(run.stderr).toContain(": check FACTORY_REPOSITORY and FACTORY_TOKEN");
    },
  );

  await then('the volume "factory" still holds that commit', async () => {
    expect(await head()).toBe(commit);
  });
});
