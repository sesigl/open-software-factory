// The sandbox adapter of the deep check `sandbox` (ADR 0120): fakes.sandbox as the command line CONSOLE_SANDBOX_COMMAND.
import type { Fakes } from "@opensoftware/testkit";

/** Starts fakes.sandbox with these options and gives it with its command line for `sh -c`. */
export async function sandboxAdapter(fakes: Fakes, options: Parameters<Fakes["sandbox"]>[0] = {}) {
  const sandbox = await fakes.sandbox(options);
  const command = [sandbox.command, ...sandbox.args].map((part) => `'${part}'`).join(" ");
  return { sandbox, env: { CONSOLE_SANDBOX_COMMAND: command } };
}
