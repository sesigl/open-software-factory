// What the library's tests share: serveProxy in the test's own process, with the scripted harness as its agent.
import { exportTranscript, type ProxyOptions, serveProxy } from "@opensoftware/harness-proxy";
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
