import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-017", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  await given('the operator ran "docker compose up --detach --wait"', async () => {
    const up = await compose.run(words("docker compose up --detach --wait"));
    expect(up.exitCode, up.stderr).toBe(0);
  });

  const foreman = (...command: string[]) => compose.run(["exec", "-T", "foreman", ...command]);
  let id = "";
  await when(
    'the service "foreman" runs "sandbox-docker create" with a spec of the image of "agent-template" and the egress allowlist "litellm"',
    async () => {
      const config = await compose.run(["config", "--format", "json"]);
      const template = (JSON.parse(config.stdout) as { services: Record<string, { image: string }> }).services[
        "agent-template"
      ]?.image as string;
      expect(template).toMatch(/\/harness-claude-code:/);
      const spec = JSON.stringify({ template, egress: ["litellm"] });
      const created = await foreman(
        "sh",
        "-c",
        `printf '%s' '${spec}' > /tmp/spec.json && sandbox-docker create /tmp/spec.json`,
      );
      expect(created.exitCode, created.stderr).toBe(0);
      id = created.stdout.trim();
      expect(id).toMatch(/^[0-9a-f]{12}$/);
    },
  );

  const inSandbox = (script: string) => foreman("sandbox-docker", "exec", id, "--", "sh", "-c", script);
  try {
    await then('the sandbox has the programs "harness-claude-code", "gh", "git" and "make"', async () => {
      const found = await inSandbox(
        "for p in harness-claude-code gh git make; do command -v $p >/dev/null && echo $p; done",
      );
      expect(found.stdout.trim().split("\n")).toEqual(["harness-claude-code", "gh", "git", "make"]);
    });

    await then(
      'in the sandbox, "GET http://litellm:4000/health/liveliness" answers 200, and a request to "http://postgres:5432" fails',
      async () => {
        // Node's fetch takes HTTP_PROXY, the sandbox's egress proxy, only with NODE_USE_ENV_PROXY.
        const fetched = (url: string) =>
          inSandbox(
            `NODE_USE_ENV_PROXY=1 node -e 'fetch("${url}").then((r) => console.log(r.status), () => console.log("failed"))'`,
          );
        expect((await fetched("http://litellm:4000/health/liveliness")).stdout.trim()).toBe("200");
        expect((await fetched("http://postgres:5432")).stdout.trim()).not.toBe("200");
      },
    );
  } finally {
    await then(
      'after "sandbox-docker destroy", "sandbox-docker list" in the service "foreman" does not list the sandbox',
      async () => {
        const destroyed = await foreman("sandbox-docker", "destroy", id);
        expect(destroyed.exitCode, destroyed.stderr).toBe(0);
        expect((await foreman("sandbox-docker", "list")).stdout.split("\n")).not.toContain(id);
      },
    );
  }

  await then(
    'in the service "foreman", "docker version" exits with code 0, and "docker volume ls" and a container with the bind mount "/:/host" fail with "Forbidden"',
    async () => {
      const version = await foreman("docker", "version");
      expect(version.exitCode, version.stderr).toBe(0);
      const volumes = await foreman("docker", "volume", "ls");
      const bind = await foreman("docker", "create", "-v", "/:/host", "alpine", "true");
      expect([volumes.exitCode, bind.exitCode]).toEqual([1, 1]);
      expect([volumes.stderr, bind.stderr]).toEqual([
        expect.stringContaining("Forbidden"),
        expect.stringContaining("Forbidden"),
      ]);
    },
  );

  await then(
    'the service "foreman" has no file "/var/run/docker.sock", and "docker-proxy" answers 403 to the service "console"',
    async () => {
      expect((await foreman("test", "-e", "/var/run/docker.sock")).exitCode).toBe(1);
      const ping = await compose.run([
        "exec",
        "-T",
        "console",
        "node",
        "-e",
        'fetch("http://docker-proxy:2375/_ping", { method: "HEAD" }).then((r) => console.log(r.status))',
      ]);
      expect(ping.stdout.trim()).toBe("403");
    },
  );
});
