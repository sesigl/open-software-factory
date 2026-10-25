// The inbox of the server: submit and read work items, and relay the outbox to NATS (ADR 0063).
import type { WorkItemView } from "@opensoftware/contracts";
import { publishToNats } from "../adapters/nats.ts";
import type { Store } from "../adapters/store.ts";
import { receivedEvent, SUBJECT, viewOf } from "../domain/view.ts";
import { workItemOf } from "../domain/work-item.ts";

export interface InboxConfig {
  nats: string | undefined;
  now: () => number;
  warn: (text: string) => void;
}

export function inbox(store: Store, config: InboxConfig) {
  let relaying: Promise<void> = Promise.resolve();
  /** Publishes the waiting events in order, one relay at a time. They stay in the outbox while NATS is away. */
  const relay = (): Promise<void> => {
    const { nats } = config;
    if (!nats) return relaying;
    relaying = relaying.then(async () => {
      try {
        const waiting = await store.unpublished();
        if (!waiting.length) return;
        await publishToNats(nats, waiting);
        await store.published(waiting.map(({ seq }) => seq));
      } catch (error) {
        config.warn(`the events wait in the outbox: ${(error as Error).message}`);
      }
    });
    return relaying;
  };

  const view = async (id: string): Promise<WorkItemView | undefined> => {
    const stored = await store.get(id);
    return stored && viewOf(stored);
  };

  return {
    relay,
    view,
    /** The work item of the submission, and whether this submission created it. */
    async submit(submission: unknown): Promise<{ created: boolean; view: WorkItemView }> {
      const workItem = workItemOf(submission);
      const at = config.now();
      const event = config.nats ? { subject: SUBJECT, event: receivedEvent(workItem, at) } : undefined;
      const created = await store.submit(workItem, at, event);
      if (created) await relay();
      return { created, view: (await view(workItem.id)) as WorkItemView };
    },
  };
}

export type Inbox = ReturnType<typeof inbox>;
