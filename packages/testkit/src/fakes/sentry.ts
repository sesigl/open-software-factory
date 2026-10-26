// A fake of Sentry's integration platform (ADR 0065): it sends a module's webhook the `event_alert` of an alert rule,
// signed like Sentry with the client secret of an internal integration. Issue and event IDs come from counters, so a
// test knows them; it sends only to URLs on the local host.
import { createHmac } from "node:crypto";

export interface SentryAlert {
  /** The Sentry issue's ID, like "1117540176". */
  issueId: string;
  /** The event's page in Sentry. */
  webUrl: string;
  /** The status the webhook answered. */
  status: number;
}

export interface FakeSentry {
  /** The client secret of the integration; the webhook checks Sentry-Hook-Signature with it. */
  clientSecret: string;
  /**
   * Sends the `event_alert` of the rule `rule` (default "Fatal errors") about an event with the title, level and
   * release to `url`, signed with the client secret, or with `secret` when given.
   */
  alert(
    url: string,
    event: { title: string; level: string; release?: string; rule?: string },
    secret?: string,
  ): Promise<SentryAlert>;
}

const CLIENT_SECRET = "testkit-sentry-client-secret";

export function startSentry(): FakeSentry {
  let issues = 1117540175;
  return {
    clientSecret: CLIENT_SECRET,
    async alert(url, event, secret = CLIENT_SECRET) {
      if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url))
        throw new Error(`fakes.sentry sends only to the local host, not to ${url}`);
      const issueId = String(++issues);
      const eventId = createHmac("sha256", "event").update(issueId).digest("hex").slice(0, 32);
      const webUrl = `https://testkit.sentry.io/issues/${issueId}/events/${eventId}/`;
      const body = JSON.stringify({
        action: "triggered",
        installation: { uuid: "00000000-0000-4000-8000-000000000001" },
        data: {
          triggered_rule: event.rule ?? "Fatal errors",
          event: {
            event_id: eventId,
            issue_id: issueId,
            title: event.title,
            level: event.level,
            release: event.release ?? null,
            web_url: webUrl,
          },
        },
        actor: { type: "application", id: "sentry", name: "Sentry" },
      });
      const answer = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sentry-hook-resource": "event_alert",
          "sentry-hook-timestamp": "1767225600",
          "sentry-hook-signature": createHmac("sha256", secret).update(body).digest("hex"),
        },
        body,
      });
      await answer.body?.cancel();
      return { issueId, webUrl, status: answer.status };
    },
  };
}
