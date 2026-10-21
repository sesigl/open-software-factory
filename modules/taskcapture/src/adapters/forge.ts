// Reads one pull request from the forge API. GitHub and Forgejo answer GET /repos/<owner>/<repo>/pulls/<n> alike.
import { type PullRef, pullPath } from "../domain/pull.ts";

export async function readPull(ref: PullRef, token: string | undefined): Promise<unknown> {
  const path = pullPath(ref);
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `token ${token}`;
  const response = await fetch(ref.api + path, { headers });
  if (!response.ok) throw new Error(`the forge answered ${response.status} to GET ${path}`);
  return response.json();
}
