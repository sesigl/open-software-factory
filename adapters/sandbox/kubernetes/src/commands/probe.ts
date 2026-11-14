// probe <template> <host>: the deep check of `console doctor --deep` (ADR 0120). A sandbox pod with no allowed host
// sends one HTTPS request to the host; the host is refused when the egress pod's log says so. The sandbox goes
// afterwards.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import { egressEntries } from "@opensoftware/sandbox-egress";
import { egressName, sandboxName } from "../domain/names.ts";
import { create } from "./create.ts";
import { destroySandbox } from "./destroy.ts";
import type { Context } from "./sandbox.ts";

const HOST = /^[a-z0-9.-]+$/i;

export async function probeEgress(
  context: Context,
  template: string | undefined,
  host: string | undefined,
): Promise<Outcome> {
  check(template && host && HOST.test(host), "name the template and the denied host, like probe alpine:3 example.com");
  const folder = mkdtempSync(join(tmpdir(), "sandbox-kubernetes-"));
  let id = "";
  try {
    writeFileSync(join(folder, "spec.json"), JSON.stringify({ template, egress: [] }));
    id = (await create(context, join(folder, "spec.json"))).lines?.[0] ?? "";
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  try {
    const url = `https://${host}/`;
    await context.kube.run(["exec", sandboxName(id), "--", "curl", "-s", "-o", "/dev/null", "--max-time", "10", url]);
    const entries = egressEntries(await context.kube.text(["logs", egressName(id)]));
    const refused = entries.some((entry) => entry.host === host && entry.outcome === "refused");
    return { lines: [`${refused ? "refused" : "reached"} ${host}`], errors: [`sandbox ${id}`], exitCode: 0 };
  } finally {
    await destroySandbox(context, id);
  }
}
