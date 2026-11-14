// probe <template> <host> [--allow]: the deep check of `console doctor --deep` (ADR 0120). A sandbox pod with no
// allowed host, or with only the host under --allow, sends one HTTPS request to the host; the host is refused when the
// egress pod's log holds a refusal. The sandbox goes afterwards; standard error names it.
import { check, type Outcome } from "@opensoftware/cli";
import { egressEntries } from "@opensoftware/sandbox-egress";
import { egressName, sandboxName } from "../domain/names.ts";
import { start } from "./create.ts";
import { destroySandbox } from "./destroy.ts";
import type { Context } from "./sandbox.ts";

const HOST = /^[a-z0-9.-]+$/;

export async function probeEgress(
  context: Context,
  template: string,
  host: string | undefined,
  allow: boolean | undefined,
): Promise<Outcome> {
  check(HOST.test(host ?? ""), "name the template and the host, like probe alpine:3 example.com");
  const id = await start(context, { template, egress: allow ? [host as string] : undefined });
  try {
    const url = `https://${host}/`;
    await context.kube.run(["exec", sandboxName(id), "--", "curl", "-s", "-o", "/dev/null", "--max-time", "10", url]);
    const refused = egressEntries(await context.kube.text(["logs", egressName(id)])).some(
      (e) => e.outcome === "refused",
    );
    return { lines: [`${refused ? "refused" : "reached"} ${host}`], errors: [`sandbox ${id}`], exitCode: 0 };
  } finally {
    await destroySandbox(context, id);
  }
}
