// snapshot <ID>: saves the sandbox's files as an image and prints its ID, a template that create accepts.
import type { Outcome } from "@opensoftware/cli";
import { dockerText } from "../adapters/docker.ts";
import { sandboxContainer } from "./sandbox.ts";

export async function snapshot(id: string | undefined): Promise<Outcome> {
  const container = await sandboxContainer(id);
  return { lines: [await dockerText(["commit", container])] };
}
