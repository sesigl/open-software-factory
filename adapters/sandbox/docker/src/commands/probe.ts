// probe <template> <host> [--allow]: the deep check of `console doctor --deep` (ADR 0120). A sandbox with no allowed
// host, or with only the host under --allow, sends one HTTPS request to the host; the host is refused when the egress
// proxy's log holds a refusal. The sandbox goes afterwards; standard error names it.
import { check, type Outcome } from "@opensoftware/cli";
import { egressEntries } from "@opensoftware/sandbox-egress";
import { docker } from "../adapters/docker.ts";
import { egressName, sandboxName } from "../domain/names.ts";
import { start } from "./create.ts";
import { destroySandbox } from "./destroy.ts";

const HOST = /^[a-z0-9.-]+$/;

export async function probe(
  template: string,
  host: string | undefined,
  allow: boolean | undefined,
  secretsDir: string,
): Promise<Outcome> {
  check(HOST.test(host ?? ""), "name the template and the host, like probe alpine:3 example.com");
  const id = await start({ template, egress: allow ? [host as string] : undefined }, secretsDir);
  try {
    await docker(["exec", sandboxName(id), "curl", "-s", "-o", "/dev/null", "--max-time", "10", `https://${host}/`]);
    const logs = await docker(["logs", egressName(id)]);
    const refused = egressEntries(logs.stdout.toString("utf8") + logs.stderr).some((e) => e.outcome === "refused");
    return { lines: [`${refused ? "refused" : "reached"} ${host}`], errors: [`sandbox ${id}`], exitCode: 0 };
  } finally {
    await destroySandbox(id);
  }
}
