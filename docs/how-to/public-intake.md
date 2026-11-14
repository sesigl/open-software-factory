---
covers: [deploy/compose/compose.yaml, modules/intake/src/commands/hooks.ts]
---

# Give intake a public URL without a relay

Slack, GitHub and Sentry send their webhooks to a public HTTPS URL. On one machine,
[a relay](../../deploy/README.md#receive-github-issues-on-your-machine) forwards them while it runs. For a factory
that people use every day, give intake a URL of its own. This how-to uses
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), which needs no
open port and no public IP. Other ways work the same: [Tailscale Funnel](https://tailscale.com/kb/1223/funnel), or a VM
with a public IP and a reverse proxy that gets a TLS certificate, like [Caddy](https://caddyserver.com/docs/automatic-https).

## Expose only the webhook paths

intake serves its webhooks and its work item API on the same port (`INTAKE_PORT`, 8081). Make only these paths
public:

| Path | Sender | Secret that intake checks |
| --- | --- | --- |
| `POST /slack/events` | Slack's Events API | `INTAKE_SLACK_SIGNING_SECRET` |
| `POST /forge/events` | the forge's webhook | `INTAKE_WEBHOOK_SECRET` |
| `POST /sentry/events` | Sentry's internal integration | `INTAKE_SENTRY_SECRET` |

Keep `/v1/…` private: console reaches it inside the network with `INTAKE_API_TOKEN`. Do not expose gatekeeper,
foreman, console, LiteLLM, Temporal or NATS.

## Cloudflare Tunnel

1. In Cloudflare Zero Trust, open Networks → Tunnels, create a tunnel and copy its token. Keep the token in a secret
   store or in `.env`, never in a committed file.
2. Add a public hostname, like `intake.example.com`, with the service `http://intake:8081`.
3. Run the connector next to the profile, in the same Compose network:

   ```sh
   docker run --detach --network compose_default cloudflare/cloudflared:latest \
     tunnel --no-autoupdate run --token "$TUNNEL_TOKEN"
   ```

4. Allow only the three webhook paths: in Cloudflare, add a WAF rule that blocks requests to `intake.example.com`
   whose path does not start with `/slack/events`, `/forge/events` or `/sentry/events`.
5. Point each sender at the hostname: the payload URL of the GitHub webhook is `https://intake.example.com/forge/events`,
   the request URL of the Slack app's event subscriptions is `https://intake.example.com/slack/events`, and the
   webhook URL of the Sentry integration is `https://intake.example.com/sentry/events`.

## What to secure

- **Signing secrets.** Set each secret of the table, long and random (`openssl rand -hex 32` for the forge). intake
  rejects a delivery whose signature does not match, so a public URL takes only signed deliveries. Without a secret,
  intake does not serve that path.
- **TLS.** Senders reach only HTTPS. The tunnel, Funnel or the reverse proxy ends TLS; intake behind it speaks HTTP
  inside the private network only.
- **The API token.** `INTAKE_API_TOKEN` guards `/v1/…`. Keep those paths off the public hostname even so.
- **Rotation.** When a secret leaks, set a new one at the sender and in `.env`, and restart intake.
