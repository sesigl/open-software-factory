// create <spec.json>: the egress pod with iron-proxy, then the sandbox as an agent-sandbox SandboxClaim whose pod
// may reach only that egress pod (ADR 0055).
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import type { SandboxSpec } from "@opensoftware/contracts";
import {
  PROXY_DIR,
  proxyConfig,
  proxyEnv,
  READY,
  readSpec,
  resolveSecrets,
  type Secret,
} from "@opensoftware/sandbox-egress";
import { egressName, ID_LABEL, isImage } from "../domain/names.ts";
import type { PodTemplate } from "../domain/pod.ts";
import {
  caConfig,
  claim,
  egressConfig,
  egressEnv,
  egressPod,
  egressService,
  imagePod,
  list,
  sandboxTemplate,
} from "../domain/resources.ts";
import { type PodStatus, podProblem } from "../domain/status.ts";
import { destroySandbox } from "./destroy.ts";
import { type Context, sandboxPod, waitFor } from "./sandbox.ts";

const EGRESS_TIMEOUT_MS = 60_000;
const SANDBOX_TIMEOUT_MS = 120_000;

export async function create(context: Context, file: string | undefined): Promise<Outcome> {
  check(file, "name the sandbox spec, like create spec.json");
  const spec = readSpec(file as string);
  const secrets = resolveSecrets(spec, context.settings.secretsDir);
  const base = await basePod(context, spec.template);
  const id = randomBytes(6).toString("hex");
  try {
    await startEgress(context, id, spec, secrets);
    await context.kube.apply(list([sandboxTemplate(id, spec, base), ...claim(id)]));
    await waitUntilRunning(context, id);
  } catch (error) {
    await destroySandbox(context, id);
    throw new Error(`the sandbox ${id} did not start and was removed: ${(error as Error).message}`);
  }
  return { lines: [id] };
}

/** The pod the sandbox starts from: the image's, or the pod of the SandboxTemplate the template names. */
async function basePod({ kube, settings }: Context, template: string): Promise<PodTemplate> {
  if (isImage(template)) return imagePod(template);
  const found = await kube.get<{ spec: { podTemplate: PodTemplate } }>(["sandboxtemplate", template]);
  if (!found) throw new Error(`the namespace "${settings.namespace}" has no SandboxTemplate "${template}"`);
  return found.spec.podTemplate;
}

/** The egress pod with its configuration, variables and secret files; its CA goes into a ConfigMap. */
async function startEgress({ kube, settings }: Context, id: string, spec: SandboxSpec, secrets: Secret[]) {
  const name = egressName(id);
  const files = secrets.flatMap((secret) =>
    secret.provider === "file" ? [`--from-file=${secret.variable}=${join(settings.secretsDir, secret.file)}`] : [],
  );
  // kubectl reads each secret's file; the adapter never does.
  if (files.length) {
    await kube.text(["create", "secret", "generic", `${name}-files`, ...files]);
    await kube.text(["label", "secret", `${name}-files`, `${ID_LABEL}=${id}`]);
  }
  const config = proxyConfig(spec, secrets, { openbaoMount: settings.openbaoMount });
  await kube.apply(
    list([
      egressConfig(id, config),
      egressEnv(id, proxyEnv(secrets, process.env)),
      egressPod(id, settings, files.length ? `${name}-files` : undefined),
      egressService(id),
    ]),
  );
  await waitFor("the egress proxy did not start", EGRESS_TIMEOUT_MS, async () => {
    const pod = await kube.get<PodStatus>(["pod", name]);
    const problem = pod && podProblem(pod);
    if (problem) throw new Error(`the egress proxy did not start: ${problem}`);
    const logs = await kube.run(["logs", name]);
    return logs.code === 0 && logs.stdout.toString("utf8").includes(READY) ? true : undefined;
  });
  const certificate = await kube.text(["exec", name, "--", "cat", `${PROXY_DIR}/out/osf/egress-ca.crt`]);
  await kube.apply(caConfig(id, `${certificate}\n`));
}

/** Waits until agent-sandbox reports the claim ready, and stops early when the sandbox's pod cannot start. */
async function waitUntilRunning(context: Context, id: string): Promise<void> {
  await waitFor("the sandbox did not start", SANDBOX_TIMEOUT_MS, async () => {
    const pod = await context.kube.get<PodStatus>(["pod", await sandboxPod(context, id)]);
    const problem = pod && podProblem(pod);
    if (problem) throw new Error(problem);
    const ready = await context.kube.get<{ status?: { conditions?: { type: string; status: string }[] } }>([
      "sandboxclaim",
      `osf-sandbox-${id}`,
    ]);
    return ready?.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True")
      ? true
      : undefined;
  });
}
