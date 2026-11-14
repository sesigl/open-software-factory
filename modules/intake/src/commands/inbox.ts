// The inbox of the server: submit and read work items, relay the outbox to NATS (ADR 0063), and move a work item on
// with its run's events (ADR 0071).
import {
  type GateRequested,
  isValid,
  type RunBlocked,
  type WorkItemList,
  type WorkItemView,
} from "@opensoftware/contracts";
import { type NatsAt, publishToNats } from "../adapters/nats.ts";
import type { Store } from "../adapters/store.ts";
import { blockedText, gateText, type Reply, replies, runTexts } from "../domain/sources.ts";
import {
  cursorOf,
  type InboxPage,
  RETRY_SUBJECT,
  receivedEvent,
  retryEvent,
  runFactOf,
  SUBJECT,
  viewOf,
} from "../domain/view.ts";
import { workItemOf } from "../domain/work-item.ts";

export interface InboxConfig {
  nats: NatsAt | undefined;
  /** The console's base URL, for the link to a run in a reply. */
  console: string | undefined;
  now: () => number;
  /** How long a published event stays in the outbox (INTAKE_OUTBOX_KEEP). */
  keepMs: number;
  say: (text: string) => void;
  warn: (text: string) => void;
}

/** An event is the same event when its source and ID are (CloudEvents). */
const keyOf = (event: unknown) => {
  const { source, id } = (event ?? {}) as { source?: unknown; id?: unknown };
  return `${source} ${id}`;
};

export function inbox(store: Store, config: InboxConfig) {
  let relaying: Promise<void> = Promise.resolve();
  /**
   * Publishes the waiting events in order, one relay at a time. They stay in the outbox while NATS is away. Then it
   * removes the events published longer than `keepMs` ago (ADR 0116).
   */
  const relay = (): Promise<void> => {
    const { nats } = config;
    if (!nats) return relaying;
    relaying = relaying.then(async () => {
      try {
        const waiting = await store.unpublished();
        if (waiting.length) {
          await publishToNats(nats, waiting);
          await store.published(
            waiting.map(({ seq }) => seq),
            config.now(),
          );
        }
        const removed = await store.removePublished(config.now() - config.keepMs);
        if (removed) config.say(`intake removed ${removed} published events from the outbox`);
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
    /** A page of the latest work items, the one received last first, and the cursor of the next (ADR 0115). */
    async latest(page: InboxPage): Promise<WorkItemList> {
      const { ids, next } = await store.latest(page);
      const workItems = (await Promise.all(ids.map(view))) as WorkItemView[];
      return { workItems, ...(next ? { next: cursorOf(next) } : {}) };
    },
    /**
     * Moves the work item of a run event to the run's status, and gives the replies its Slack threads and issues get
     * of a run event, of a gate.requested@v1 (ADR 0113) or of a run.blocked@v1 (ADR 0127), once per event. A message that is neither is an error.
     */
    async followRun(event: unknown): Promise<Reply[]> {
      if (await store.told(keyOf(event))) return [];
      if (isValid<GateRequested>("gate-requested", event)) {
        const waiting = await view(event.data.workItemId);
        return waiting ? replies(waiting, [gateText(event.data, waiting.runId, config.console)]) : [];
      }
      if (isValid<RunBlocked>("run-blocked", event)) {
        const blocked = await view(event.data.workItemId);
        return blocked ? replies(blocked, [blockedText(event.data, config.console)]) : [];
      }
      const fact = runFactOf(event);
      if (typeof fact === "string") throw new Error(fact);
      await store.followRun(fact);
      const followed = await view(fact.workItemId);
      return followed ? replies(followed, runTexts(fact, config.console)) : [];
    },
    /** Marks the event as told, once its replies were sent. */
    told: (event: unknown) => store.tell(keyOf(event)),
    /** The work item of the submission, whether this submission created it, and whether it added its request. */
    async submit(submission: unknown): Promise<{ created: boolean; added: boolean; view: WorkItemView }> {
      const workItem = workItemOf(submission);
      const at = config.now();
      const event = config.nats ? { subject: SUBJECT, event: receivedEvent(workItem, at) } : undefined;
      const { created, added } = await store.submit(workItem, at, event);
      if (created) await relay();
      return { created, added, view: (await view(workItem.id)) as WorkItemView };
    },
    /**
     * The label put on an issue again: asks the foreman once per run to run a failed or cancelled work item again
     * (ADR 0105); a new issue becomes a work item as by `submit`.
     */
    async labeled(submission: unknown): Promise<void> {
      // A new work item, or one of a server without NATS, is "received" and asks for nothing.
      const { view: submitted } = await this.submit(submission);
      const at = config.now();
      await store.askRetry(submitted.workItem.id, (workItem, runId) => ({
        subject: RETRY_SUBJECT,
        event: retryEvent(workItem, runId, at),
      }));
      await relay();
    },
  };
}

export type Inbox = ReturnType<typeof inbox>;
