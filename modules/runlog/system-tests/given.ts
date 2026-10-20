// The Given steps that many scenarios share.
import type { Sut } from "@opensoftware/testkit";
import { claudeSession, codexSession, openCodeSession } from "./sessions.ts";

/** $INPUT is a Git repository with one commit that holds the Claude Code session as session.jsonl. */
export async function claudeRepository(sut: Sut): Promise<string> {
  await sut.files.put("$INPUT/session.jsonl", claudeSession());
  return sut.git.commit("init");
}

/** $INPUT is a Git repository with one commit that holds the Codex session as rollout.jsonl. */
export async function codexRepository(sut: Sut): Promise<string> {
  await sut.files.put("$INPUT/rollout.jsonl", codexSession());
  return sut.git.commit("init");
}

/** $INPUT is a Git repository with one commit that holds the OpenCode session as session.json. */
export async function openCodeRepository(sut: Sut): Promise<string> {
  await sut.files.put("$INPUT/session.json", openCodeSession());
  return sut.git.commit("init");
}

/** $INPUT is a Git repository with one commit that holds the Claude Code session in sessions/, ending at `minute`:45. */
export async function watchedRepository(sut: Sut, minute: string): Promise<string> {
  await sut.files.put("$INPUT/sessions/project/session.jsonl", claudeSession(minute));
  return sut.git.commit("init");
}
