// runAdapter: the command line every harness adapter shares, `run` and `transcript` (ADR 0052). The adapter names
// its harness, its usage and the agent it starts; everything else is the same for each adapter.
import { parseArgs } from "node:util";
import { type Command, check, type Io, outputPath, runProgram } from "@opensoftware/cli";
import { allowlistOf } from "./domain/allowlist.ts";
import { type ProxyOptions, serveProxy } from "./proxy.ts";
import { exportTranscript } from "./transcript.ts";

export interface AdapterOptions {
  /** The harness name: the program is `harness-<harness>` and its default data folder `.harness-<harness>`. */
  harness: string;
  usage: string;
  /** The agent that `run` starts, from the arguments after `run` and the data folder; may throw a usage error. */
  agent: (args: string[], data: string) => ProxyOptions["agent"];
  /** Changes each `session/new` request of the client before the agent gets it. */
  newSession?: ProxyOptions["newSession"];
  /** The request the agent takes a steering message as; see `serveProxy`. */
  steering?: ProxyOptions["steering"];
}

export interface AdapterContext {
  /** The command line after the program. */
  args: string[];
  /** The variables OSF_DATA, OUTPUT and the OTEL_ resource attributes are read from. */
  env: NodeJS.ProcessEnv;
  /** Where `run` serves ACP. Default: stdio. */
  streams?: ProxyOptions["io"];
  /** Where the program writes its output and errors. Default: stdout and stderr. */
  io?: Io;
}

/** Runs the adapter's command and gives the exit code; `run` ends when its agent has exited. */
export function runAdapter(
  options: AdapterOptions,
  context: AdapterContext = { args: process.argv.slice(2), env: process.env },
): Promise<number> {
  const { env } = context;
  const { positionals, values } = parseArgs({
    args: context.args,
    allowPositionals: true,
    options: { allow: { type: "string" }, help: { type: "boolean" } },
  });
  const [name, ...rest] = positionals;
  const data = env.OSF_DATA ?? `.harness-${options.harness}`;

  const run: Command = async () => {
    await serveProxy({
      agent: options.agent(rest, data),
      allow: allowlistOf(values.allow),
      data,
      newSession: options.newSession,
      steering: options.steering,
      io: context.streams,
    });
    return {};
  };

  const transcript: Command = () => {
    const [sessionId] = rest;
    check(sessionId !== undefined, "name the session ID");
    const output = outputPath("", undefined, env);
    const written = exportTranscript({ sessionId, data, output, harness: options.harness });
    return { lines: [`wrote ${written.recordFile}`, `wrote ${written.transcriptFile}`] };
  };

  const commands: Record<string, Command> = { run, transcript };
  return runProgram(
    { name: `harness-${options.harness}`, usage: options.usage, command: commands[name as string], help: values.help },
    context.io,
  );
}
