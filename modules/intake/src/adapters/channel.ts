// @ts-nocheck
// The channel port's adapter (ADR 0059, ADR 0063): intake runs `receive` on each delivery and `reply` in a thread.
import { type Delivery, type Lines, program } from "./program.ts";

export interface ChannelSettings {
  command: string;
  apiUrl: string | undefined;
  token: string;
  signingSecret: string;
}

export interface Channel {
  /** The lines `receive` prints for a delivery; undefined when the adapter refuses its signature. */
  receive(delivery: Delivery): Promise<Lines | undefined>;
  reply(thread: string, text: string): Promise<void>;
}

export function channelAdapter(settings: ChannelSettings): Channel {
  const adapter = program(settings.command, {
    CHANNEL_API_URL: settings.apiUrl,
    CHANNEL_TOKEN: settings.token,
    CHANNEL_SIGNING_SECRET: settings.signingSecret,
  });
  return {
    receive: (delivery) => adapter.deliver("receive", delivery),
    async reply(thread, text) {
      await adapter.run(["reply", thread, text]);
    },
  };
}
