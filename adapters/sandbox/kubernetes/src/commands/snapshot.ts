// snapshot <ID>: copies /workspace into a PersistentVolumeClaim and prints a SandboxTemplate that create accepts,
// whose sandboxes start with those files (ADR 0055).
import { randomBytes } from "node:crypto";
import type { Outcome } from "@opensoftware/cli";
import { WORKSPACE } from "@opensoftware/sandbox-egress";
import { BASE_ANNOTATION, sandboxName, snapshotName } from "../domain/names.ts";
import type { PodTemplate } from "../domain/pod.ts";
import { list } from "../domain/resources.ts";
import {
  SNAPSHOT_DIR,
  SNAPSHOT_LABEL,
  snapshotTemplate,
  snapshotVolume,
  writerName,
  writerPod,
} from "../domain/snapshot.ts";
import { type PodStatus, podProblem } from "../domain/status.ts";
import { type Context, sandboxPod, waitFor } from "./sandbox.ts";

const WRITER_TIMEOUT_MS = 120_000;

export async function snapshot(context: Context, id: string | undefined): Promise<Outcome> {
  const { kube, settings } = context;
  const pod = await sandboxPod(context, id);
  const template = await kube.get<{ metadata: { annotations?: Record<string, string> } }>([
    "sandboxtemplate",
    sandboxName(id as string),
  ]);
  const base = JSON.parse(template?.metadata.annotations?.[BASE_ANNOTATION] ?? "null") as PodTemplate;
  const image = base.spec.containers[0]?.image as string;
  const snap = randomBytes(6).toString("hex");
  const writer = writerName(snap);
  // The writer goes in any case; a snapshot that was not saved takes its claim and template with it.
  let saved = false;
  try {
    await kube.apply(list([snapshotVolume(snap, settings.snapshotSize), writerPod(snap, image)]));
    await waitFor("the snapshot's writer did not start", WRITER_TIMEOUT_MS, async () => {
      const status = await kube.get<PodStatus>(["pod", writer]);
      const problem = status && podProblem(status);
      if (problem) throw new Error(`the snapshot's writer did not start: ${problem}`);
      return status?.status?.phase === "Running" ? true : undefined;
    });
    await kube.pipe(
      ["exec", pod, "--", "tar", "-cf", "-", "-C", WORKSPACE, "."],
      ["exec", "--stdin", writer, "--", "tar", "-xf", "-", "-C", SNAPSHOT_DIR],
    );
    await kube.apply(snapshotTemplate(snap, base));
    saved = true;
  } finally {
    const kinds = saved ? "pod" : "pod,pvc,sandboxtemplate";
    await kube.run(["delete", kinds, "--selector", `${SNAPSHOT_LABEL}=${snap}`, "--wait=false"]);
  }
  return { lines: [snapshotName(snap)] };
}
