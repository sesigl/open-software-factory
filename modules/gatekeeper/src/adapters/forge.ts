// A pull request through the forge port (ADR 0062): the request is a comment, decisions are later comments, and the
// result is the check "gatekeeper", a commit status of the head commit. The adapter program talks to the forge.
import type { Channel, Message } from "../domain/gate.ts";
import { forgeOf, type PullLine, type PullRequest } from "../domain/pull-request.ts";
import { fromIso } from "../domain/time.ts";
import type { Program } from "./program.ts";

export interface Forge {
  /** The pull request as the port's `pr` prints it. */
  read(): Promise<PullLine>;
  /** Sets the check "gatekeeper" of the commit. */
  status(sha: string, state: "pending" | "success" | "failure", description: string): Promise<void>;
  /** The pull request's comments as the channel of its gate. */
  channel(pull: PullLine): Channel;
}

export function pullRequestForge(pr: PullRequest, run: Program): Forge {
  const repo = `${pr.owner}/${pr.repo}`;
  const number = String(pr.number);
  const comments = async (): Promise<Message[]> =>
    (await run(["comments", repo, number])).map((line) => ({
      id: String(line.id),
      author: String(line.author),
      time: fromIso(String(line.time)),
      text: String(line.text ?? ""),
      mine: line.mine === true,
    }));
  const comment = async (text: string, marker: string): Promise<string> => {
    const [posted] = await run(["comment", repo, number, `${text}\n\n<!-- ${marker} -->`]);
    return String(posted?.id);
  };

  return {
    async read() {
      const [line] = await run(["pr", repo, number]);
      return line as unknown as PullLine;
    },
    async status(sha, state, description) {
      const args = ["check", repo, sha, "gatekeeper", state, "--description", description.slice(0, 140)];
      await run([...args, "--url", pr.url]);
    },
    channel(pull) {
      const prefix = `${forgeOf(pull)}:`;
      return {
        name: pr.url,
        mention: (identity) => (identity.startsWith(prefix) ? `@${identity.slice(prefix.length)}` : identity),
        howToDecide: 'Comment "/approve" or "/reject <reason>".',
        async find(marker) {
          return (await comments()).find((entry) => entry.mine && entry.text.includes(`<!-- ${marker} -->`));
        },
        async thread(request) {
          const all = await comments();
          return all.slice(all.findIndex((entry) => entry.id === request.id) + 1);
        },
        async ask(text, marker) {
          return { id: await comment(text, marker) };
        },
        async answer(_request, text, marker) {
          await comment(text, marker);
        },
      };
    },
  };
}
