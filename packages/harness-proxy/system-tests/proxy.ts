// What the library's tests share: serveProxy in the test's own process, with the scripted harness as its agent.
import {
  type AdapterContext,
  exportTranscript,
  type ProxyOptions,
  runAdapter,
  serveProxy,
} from "@opensoftware/harness-proxy";
import type { AcpClient, Harness, Sut } from "@opensoftware/testkit";

/** The data folder the tests record sessions in. */
export const DATA = "$OUTPUT/data";

/** Starts serveProxy for `harness` and connects a client to it; `approve: false` refuses every tool call. */
export function serve(
  sut: Sut,
  harness: Harness,
  options: Partial<ProxyOptions> & { approve?: boolean } = {},
): Promise<AcpClient> {
  const { approve, ...proxy } = options;
  return sut.acp.serve(
    (io) =>
      serveProxy({
        agent: { command: harness.command, args: harness.args },
        data: sut.files.path(DATA),
        resource: {},
        io,
        ...proxy,
      }),
    { approve },
  );
}

/** Exports the transcript of a session of the harness "demo" into $OUTPUT. */
export const exportDemo = (sut: Sut, sessionId: string) =>
  exportTranscript({ sessionId, data: sut.files.path(DATA), output: sut.files.path("$OUTPUT"), harness: "demo" });

/** The lines of a transcript file. */
export async function linesOf(sut: Sut, file: string): Promise<Record<string, unknown>[]> {
  return (await sut.files.read(file))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

/** A session in which the client sent `prompt` once to `harness` behind serveProxy; gives the session's ID. */
export async function ranSession(
  sut: Sut,
  harness: Harness,
  prompt: string,
  options: Partial<ProxyOptions> & { approve?: boolean } = {},
): Promise<string> {
  const session = await (await serve(sut, harness, options)).newSession();
  await session.prompt(prompt);
  return session.id;
}

/** The adapter "demo" of runAdapter: its agent is the command after "--". */
export const demoAdapter = {
  harness: "demo",
  usage: "Usage: demo\n",
  agent: ([command, ...args]: string[]) => ({ command: command as string, args }),
};

/** Output and errors written to strings, for the `io` of runAdapter. */
export function captured(): { stdout: string; stderr: string; io: NonNullable<AdapterContext["io"]> } {
  const out = { stdout: "", stderr: "" };
  const io = {
    stdout: { write: (text: string) => (out.stdout += text) },
    stderr: { write: (text: string) => (out.stderr += text) },
  };
  return Object.assign(out, { io });
}

/** Starts runAdapter "run" for the adapter "demo" with `args` and connects a client to it. */
export const serveDemo = (sut: Sut, args: string[], env: AdapterContext["env"] = {}): Promise<AcpClient> =>
  sut.acp.serve((streams) => runAdapter(demoAdapter, { args: ["run", ...args], env, streams }));
