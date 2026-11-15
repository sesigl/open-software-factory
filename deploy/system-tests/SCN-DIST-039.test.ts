import { randomBytes } from "node:crypto";
import { scenario } from "@opensoftware/testkit";
import { OPENBAO, profile, words } from "./profile.ts";

// The test template of the sandbox adapters' scenarios: curl and a shell, pulled by the foreman through docker-proxy.
const TEMPLATE = "curlimages/curl:8.17.0@sha256:935d9100e9ba842cdb060de42472c7ca90cfe9a7c96e4dacb55e79e560b3ff40";
// The services that hold the secret: OpenBao with its job, and docker-proxy for the foreman's sandbox. The console and
// the foreman run with "docker compose run --no-deps", as their settings are what the scenario proves.
const UP = "docker compose up --detach --wait openbao-setup docker-proxy";

scenario("SCN-DIST-039", async ({ sut, fakes, given, when, then }) => {
  // Made up for this run: no store outside the scenario ever held it.
  const value = `lin_${randomBytes(12).toString("hex")}`;
  let compose: Awaited<ReturnType<typeof profile>>;
  let env = new Map<string, string>();
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", OpenBao\'s unseal key, root token and two token IDs as "osf init" generates them',
    async () => {
      compose = await profile(sut);
      const text = await sut.files.read("$INPUT/.env");
      env = new Map(text.split("\n").map((line) => line.split("=", 2) as [string, string]));
      for (const name of OPENBAO) expect(env.get(name)).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  const up = async () => {
    const started = await compose.run(words(UP));
    expect(started.exitCode, started.stderr).toBe(0);
  };
  await given(`the operator ran "${UP}"`, up);

  /** A command of the service's image with the service's settings, without starting what it depends on. */
  const inService = (service: string, script: string, more: string[] = []) =>
    compose.run(["run", "--rm", "--no-deps", "-T", ...more, service, "sh", "-c", script]);

  await given(
    'the console\'s secrets adapter stored "linear-token" with the console\'s token, by "ada@acme.dev"',
    async () => {
      // What /secrets runs: the console's adapter with the value on its standard input only.
      const put = await inService(
        "console",
        `printf %s '${value}' | secrets-openbao put linear-token --by ada@acme.dev`,
      );
      expect(put.exitCode, put.stderr).toBe(0);
      expect(put.stdout.trim().split("\n").at(-1)).toBe('{"name":"linear-token","version":1}');
    },
  );

  await when(`the operator runs "docker compose down" and then "${UP}"`, async () => {
    const down = await compose.run(["down", "--timeout", "2"]);
    expect(down.exitCode, down.stderr).toBe(0);
    await up();
  });

  await then('the service "openbao" is running, healthy and unsealed, and no person unsealed it', async () => {
    const openbao = (await compose.services()).find((service) => service.service === "openbao");
    expect({ state: openbao?.state, health: openbao?.health }).toEqual({ state: "running", health: "healthy" });
    const status = await compose.run(["exec", "-T", "openbao", "bao", "status", "-format=json"]);
    // The static seal of .env's key unsealed it at its start: no unseal key exists to give to a person.
    expect(JSON.parse(status.stdout)).toMatchObject({ initialized: true, sealed: false, type: "static" });
  });

  await then(
    '"secrets-openbao list" in the service "console" names "linear-token" in version 1 by "ada@acme.dev"',
    async () => {
      const list = await inService("console", "secrets-openbao list");
      expect(list.exitCode, list.stderr).toBe(0);
      expect(JSON.parse(list.stdout.trim().split("\n").at(-1) ?? "")).toMatchObject({
        name: "linear-token",
        version: 1,
        by: "ada@acme.dev",
      });
    },
  );

  await then('OpenBao refuses the console\'s token a read of the value of "linear-token" with 403', async () => {
    const token = env.get("OSF_OPENBAO_CONSOLE_TOKEN") as string;
    const read = await compose.run([
      "exec",
      "-T",
      "-e",
      `BAO_TOKEN=${token}`,
      "openbao",
      "bao",
      "kv",
      "get",
      "secret/linear-token",
    ]);
    expect(read.exitCode).toBe(2);
    expect(read.stderr).toContain("Code: 403");
    expect(read.stdout + read.stderr).not.toContain(value);
  });

  await then(
    'a sandbox that the service "foreman" creates with the egress allowlist "host.docker.internal" and "LINEAR_TOKEN" from "ref:openbao/linear-token" sends "Authorization: Bearer" and the value to the API at "host.docker.internal"',
    async () => {
      const api = await fakes.http([{ path: "/viewer", body: { login: "ada" } }], { containers: true });
      const spec = JSON.stringify({
        template: TEMPLATE,
        egress: ["host.docker.internal"],
        secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" },
      });
      // The sandbox holds a placeholder; its egress proxy reads the value from openbao with the foreman's token.
      const script = [
        `printf '%s' '${spec}' > /tmp/spec.json`,
        "id=$(sandbox-docker create /tmp/spec.json) || exit 1",
        `trap 'sandbox-docker destroy "$id" >/dev/null' EXIT`,
        `sandbox-docker exec "$id" -- sh -c 'curl -sS -H "Authorization: Bearer $LINEAR_TOKEN" ${api.containerUrl}/viewer'`,
      ].join("\n");
      // With the service's name on the network, which docker-proxy lets in.
      const sandbox = await inService("foreman", script, ["--use-aliases"]);
      expect(sandbox.exitCode, sandbox.stderr).toBe(0);
      expect(api.headers()).toMatchObject([
        { method: "GET", path: "/viewer", headers: { authorization: `Bearer ${value}` } },
      ]);
    },
  );

  await then(
    'the audit log on the volume "openbao" names the read of "secret/data/linear-token" and does not hold the value',
    async () => {
      const audit = await compose.run(["exec", "-T", "openbao", "cat", "/openbao/file/audit.log"]);
      expect(audit.exitCode, audit.stderr).toBe(0);
      const reads = audit.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { type: string; request?: { operation?: string; path?: string } })
        .filter((entry) => entry.type === "request" && entry.request?.operation === "read");
      expect(reads.map((entry) => entry.request?.path)).toContain("secret/data/linear-token");
      expect(audit.stdout).not.toContain(value);
    },
  );
});
