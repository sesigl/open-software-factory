// kubectl, the adapter's only way to the cluster (ADR 0055). It follows KUBECONFIG and the current context like any
// kubectl command; every call runs in the adapter's namespace.
import { type ChildProcess, spawn } from "node:child_process";

export interface KubectlResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

export interface Kubectl {
  /** Runs `kubectl <args>` and collects its output; `input` goes to its standard input. */
  run(args: string[], input?: string): Promise<KubectlResult>;
  /** Runs `kubectl <args>` and gives its standard output as text; a failure throws with kubectl's error. */
  text(args: string[], input?: string): Promise<string>;
  /** `kubectl get <args>` as JSON, or undefined when the object does not exist. */
  get<T>(args: string[]): Promise<T | undefined>;
  /** `kubectl apply -f -` with the objects as JSON. */
  apply(objects: unknown): Promise<void>;
  /** Runs `kubectl <args>` on the program's own standard input and output, and gives its exit code. */
  attached(args: string[]): Promise<number>;
  /** Runs `kubectl <from>` and streams its standard output into `kubectl <to>`; throws when either fails. */
  pipe(from: string[], to: string[]): Promise<void>;
}

export function kubectl(namespace: string): Kubectl {
  const withNamespace = (args: string[]) => ["--namespace", namespace, ...args];
  const run = (args: string[], input?: string) => collect(spawn("kubectl", withNamespace(args)), input);
  const text = async (args: string[], input?: string) => {
    const result = await run(args, input);
    if (result.code !== 0) throw new Error(`kubectl ${args[0]} failed: ${result.stderr.trim()}`);
    return result.stdout.toString("utf8").trim();
  };
  return {
    run,
    text,
    async get<T>(args: string[]) {
      const json = await text(["get", ...args, "--output", "json", "--ignore-not-found"]);
      return json ? (JSON.parse(json) as T) : undefined;
    },
    async apply(objects) {
      await text(["apply", "-f", "-"], JSON.stringify(objects));
    },
    attached: (args) =>
      new Promise((resolve, reject) => {
        const child = spawn("kubectl", withNamespace(args), { stdio: "inherit" });
        child.on("error", reject);
        child.on("close", (code) => resolve(code ?? 1));
      }),
    async pipe(from, to) {
      const source = spawn("kubectl", withNamespace(from), { stdio: ["ignore", "pipe", "pipe"] });
      const target = spawn("kubectl", withNamespace(to), { stdio: ["pipe", "pipe", "pipe"] });
      source.stdout.pipe(target.stdin);
      const [out, into] = await Promise.all([collect(source, undefined, false), collect(target, null)]);
      for (const [args, result] of [
        [from, out],
        [to, into],
      ] as const) {
        if (result.code !== 0) throw new Error(`kubectl ${args[0]} failed: ${result.stderr.trim()}`);
      }
    },
  };
}

/**
 * Waits for the process and gives what it wrote. `input` goes to its standard input, which `null` leaves to a pipe;
 * `output: false` leaves its standard output to a pipe.
 */
async function collect(child: ChildProcess, input?: string | null, output = true): Promise<KubectlResult> {
  const closed = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  if (input !== null) child.stdin?.end(input);
  const [stdout, stderr, code] = await Promise.all([
    output && child.stdout ? child.stdout.toArray() : [],
    child.stderr ? child.stderr.toArray() : [],
    closed,
  ]);
  return {
    code,
    stdout: Buffer.concat(stdout as Buffer[]),
    stderr: Buffer.concat(stderr as Buffer[]).toString("utf8"),
  };
}
