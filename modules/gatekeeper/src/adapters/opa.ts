// Runs `opa eval` as a separate process (ADR 0047): the request is `input`, the answer is `data.gatekeeper`.
import { spawn } from "node:child_process";
import { UsageError } from "@opensoftware/cli";

interface OpaOutput {
  result?: { expressions: { value: unknown }[] }[];
  errors?: { message: string; location?: { file: string; row: number } }[];
}

export async function evaluate(opa: string, policy: string, input: unknown): Promise<unknown> {
  const child = spawn(opa, ["eval", "--format", "json", "--data", policy, "--stdin-input", "data.gatekeeper"]);
  let stdout = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.resume();
  child.stdin.on("error", () => {}).end(JSON.stringify(input));
  const code = await new Promise<number>((resolve, reject) => {
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(
        new Error(
          `could not start ${opa} (${error.code}): install OPA 1.x (https://www.openpolicyagent.org/docs#running-opa) or set GATEKEEPER_OPA`,
        ),
      ),
    );
    child.on("close", (exit) => resolve(exit ?? 1));
  });
  let output: OpaOutput;
  try {
    output = JSON.parse(stdout) as OpaOutput;
  } catch {
    throw new Error(`${opa} answered no JSON (exit ${code})`);
  }
  if (code !== 0 || output.errors) {
    const errors = (output.errors ?? []).map(({ message, location }) =>
      location ? `${location.file}:${location.row}: ${message}` : message,
    );
    throw new UsageError(`OPA cannot evaluate ${policy}: ${errors.join("; ") || `exit ${code}`}`);
  }
  return output.result?.[0]?.expressions[0]?.value;
}
