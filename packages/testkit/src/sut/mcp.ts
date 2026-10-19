// sut.mcp: the module as an MCP server over stdio, driven by the official MCP client.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Launch } from "./launch.ts";

export type McpClient = Client;

export interface Mcp {
  /**
   * Starts the module's artifact with these arguments as an MCP server on stdio and returns a connected client
   * (`listTools`, `callTool`, `listResources`, ...). The server stops when the scenario ends.
   */
  connect(args?: string[], options?: { env?: Record<string, string> }): Promise<McpClient>;
}

export function makeMcp(launch: Launch, onStop: (stop: () => Promise<unknown>) => void): Mcp {
  return {
    async connect(args = [], options = {}) {
      const { command, argv, cwd, env } = launch(args, options.env);
      const transport = new StdioClientTransport({ command, args: argv, cwd, env, stderr: "pipe" });
      let stderr = "";
      transport.stderr?.on("data", (chunk) => (stderr += chunk));
      const client = new Client({ name: "opensoftware-testkit", version: "0.0.0" });
      try {
        await client.connect(transport);
      } catch (error) {
        await transport.close();
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`sut.mcp: the module did not answer the MCP handshake: ${reason}\n${stderr}`);
      }
      onStop(() => client.close());
      return client;
    },
  };
}
