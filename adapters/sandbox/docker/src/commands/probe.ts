// probe <template> <host>: the deep check of `console doctor --deep` (ADR 0120). A sandbox with no allowed host sends
// one HTTPS request to the host; the host is refused when the egress proxy's log says so. The sandbox goes afterwards.
import { check, type Outcome } from "@opensoftware/cli";
import { egressEntries } from "@opensoftware/sandbox-egress";
import { docker } from "../adapters/docker.ts";
import { withFolder } from "../adapters/files.ts";
import { egressName, sandboxName } from "../domain/names.ts";
import { create } from "./create.ts";
import { destroySandbox } from "./destroy.ts";

const HOST = /^[a-z0-9.-]+$/i;

export async function probe(
  template: string | undefined,
  host: string | undefined,
  secretsDir: string,
): Promise<Outcome> {
  check(template && host && HOST.test(host), "name the template and the denied host, like probe alpine:3 example.com");
  const spec = { "spec.json": JSON.stringify({ template, egress: [] }) };
  const started = await withFolder(spec, (folder) => create(`${folder}/spec.json`, secretsDir));
  const id = started.lines?.[0] ?? "";
  try {
    await docker(["exec", sandboxName(id), "curl", "-s", "-o", "/dev/null", "--max-time", "10", `https://${host}/`]);
    const logs = await docker(["logs", egressName(id)]);
    const entries = egressEntries(logs.stdout.toString("utf8") + logs.stderr);
    const refused = entries.some((entry) => entry.host === host && entry.outcome === "refused");
    return { lines: [`${refused ? "refused" : "reached"} ${host}`] };
  } finally {
    await destroySandbox(id);
  }
}
