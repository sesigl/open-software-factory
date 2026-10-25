// What a GitHub delivery means for the factory, without I/O (ADR 0059): a person's mention of the bot in a pull
// request's conversation as a work item, the text of an approval card, and an answer to it as a decision.

/** A comment of the conversation: its ID, whether the bot wrote it, and its text. */
export interface Comment {
  id: string;
  mine: boolean;
  text: string;
}

/** The line of a card that names its choices; GitHub has no buttons, so a person answers with `/<choice>`. */
const ANSWER = /^Answer with (\/\S+(?: or \/\S+)*)\.$/m;

/** The text under a card's question: how to answer it. */
export function answerLine(choices: string[]): string {
  return `Answer with ${choices.map((choice) => `/${choice}`).join(" or ")}.`;
}

/** The choice of an answer such as `/approve`, or undefined for any other text. */
export function choiceOf(text: string): string | undefined {
  return /^\/([\w-]+)$/.exec(text.trim())?.[1];
}

/** The newest card of the bot that offers the choice, from the conversation's comments, oldest first. */
export function cardFor(comments: Comment[], choice: string): Comment | undefined {
  return comments.findLast((comment) => {
    const line = comment.mine ? ANSWER.exec(comment.text)?.[1] : undefined;
    return line?.split(" or ").includes(`/${choice}`) ?? false;
  });
}

export interface Mention {
  thread: string;
  message: string;
  text: string;
  /** The bot's login, which a mention names as `@<login>`. */
  bot: string;
  login: string;
  url: string;
}

/** The work item of a person's comment that mentions the bot (contracts/work-item). */
export function workItem(mention: Mention): Record<string, unknown> {
  const said = mention.text.replaceAll(`@${mention.bot}`, "").trim();
  const [title = ""] = said.split("\n");
  const requester = { kind: "person", id: `github:${mention.login}`, displayName: mention.login };
  const origin = { source: "github", url: mention.url, externalId: mention.thread };
  const id = `${mention.thread}/${mention.message}`;
  const workItem = { id, type: "task", title: title.trim().slice(0, 300), description: said, requester, origin };
  return { kind: "work", workItem: { ...workItem, dedupeKey: mention.thread } };
}

/** A comment as GitHub's REST API gives it, inside the SDK's raw message. */
interface Raw {
  comment: { id: number; body: string; created_at: string; user: { login: string } };
}

/** A comment of history: its text as GitHub keeps it, and whether the bot wrote it. */
export function said(
  raw: unknown,
  bot: string,
): { id: string; person: string; time: string; text: string; mine: boolean } {
  const { comment } = raw as Raw;
  const time = new Date(comment.created_at).toISOString().replace(".000Z", "Z");
  return {
    id: String(comment.id),
    person: `github:${comment.user.login}`,
    time,
    text: comment.body,
    mine: comment.user.login === bot,
  };
}
