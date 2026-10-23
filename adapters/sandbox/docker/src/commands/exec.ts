// exec <ID> -- <command>...: runs the command in the sandbox's working folder and exits with its code.
import { check, type Outcome } from "@opensoftware/cli";
import { WORKSPACE } from "@opensoftware/sandbox-egress";
import { dockerAttached } from "../adapters/docker.ts";
import { sandboxContainer } from "./sandbox.ts";

export async function exec(id: string | undefined, command: string[]): Promise<Outcome> {
  check(command.length > 0, "name the command after --, like exec <ID> -- pwd");
  const container = await sandboxContainer(id);
  return { exitCode: await dockerAttached(["exec", "--interactive", "--workdir", WORKSPACE, container, ...command]) };
}
