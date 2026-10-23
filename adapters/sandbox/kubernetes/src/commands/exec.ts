// exec <ID> -- <command>...: runs the command in the sandbox's working folder and exits with its code.
import { check, type Outcome } from "@opensoftware/cli";
import { type Context, sandboxPod } from "./sandbox.ts";

export async function exec(context: Context, id: string | undefined, command: string[]): Promise<Outcome> {
  check(command.length > 0, "name the command after --, like exec <ID> -- pwd");
  const pod = await sandboxPod(context, id);
  // The pod's working folder is /workspace, and kubectl exits with the command's code.
  return { exitCode: await context.kube.attached(["exec", "--stdin", "--quiet", pod, "--", ...command]) };
}
