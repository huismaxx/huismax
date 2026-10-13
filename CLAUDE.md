# huismax: notes for Claude

Read `README.md` for how the site is built. This file covers the infrastructure around it and who does what.

## Two Claudes

- **Desktop Claude (this repo):** the website, the frontend, UI/UX, website repos, client-side tracking, the Chatwoot widget, forms and conversion flows, and working out what the website needs from the server.
- **Server Claude:** Docker, Linux, n8n, Umami, Chatwoot, Mautic, Penpot, Homepage, databases, credentials, server APIs, logs, deploys on the server, monitoring and backups.

The two can't talk to each other. When website work needs something done on the server, don't guess the server's setup and don't hand Max raw commands. Write a short, self-contained message for Server Claude, ending with exactly what to send back (IDs, URLs, tokens), and ask Max to forward it. Pending asks are listed under "Open server requests" below.

## Hosting

The public site stays on Cloudflare Workers. Never move it onto the home server. It connects to the self-hosted services over their public URLs. If one of them goes down, the site still has to load and work.

## Self-hosted services

| Service | URL | Role for the website |
|---|---|---|
| Umami | https://analytics.huismax.com | Main analytics: page views, events, conversions. There is no Google Analytics on the site, so don't add any. |
| Chatwoot | https://chat.huismax.com | The backend of the homepage's live chat_ (public client API + websocket, in the site's own design). Don't build a support backend. |
| Mautic | https://mautic.huismax.com | Marketing automation. Only for real leads, subscribers, campaign participants and customers. |
| n8n | https://n8n.huismax.com | The glue between systems (form → Mautic/Chatwoot/notifications, GitHub → ops, Chatwoot → AI). Core site logic stays in code. |
| Penpot | https://design.huismax.com | Design and prototyping for big redesigns, design systems and complex flows. Small UI changes go straight into code. |
| Homepage | internal only | Max's dashboard. Never link it from the public site. |

Intended flow: visitor → Umami → conversion (contact, signup, download) → Mautic contact when it is a real lead → n8n → follow-up systems.

Rules:
- Every integration fails quietly and loads after the page. A blocked or offline script must never break a page or slow first paint.
- Nothing third-party goes on `/admin`.
- Public IDs (Umami website ID, Chatwoot website token) go in `wrangler.jsonc` `vars`. Real secrets (API keys, webhook secrets) are Worker **Secrets** and stay on the worker, never in the browser.
- If the site ever adds a Content-Security-Policy, it has to allow `analytics.huismax.com` and `chat.huismax.com`.

## Analytics (Umami)

Status: **live once merged.** Website ID `40d0a0b8-a849-4f29-b66e-85cfb3b35e92` (Umami 3.4.0). Without `UMAMI_WEBSITE_ID`, pages carry no analytics.

- `src/views/layout.tsx` adds `https://analytics.huismax.com/stats.js` (the server's name for Umami's `script.js`, less often blocked; `defer`, `data-domains="huismax.com"`) only when `UMAMI_WEBSITE_ID` (a UUID, in `wrangler.jsonc` `vars`) is set. So local dev and branch previews (which get no vars) aren't counted. The ID is public; commit it in `wrangler.jsonc`, since a value there overrides one set in the dashboard on every deploy.
- Umami counts page views itself, router navigations included (it follows `pushState`). It also records referrers and `utm_*`, so campaign links need no code.
- All events go through `client/lib/track.ts`: `track(name, props)` for code, `data-track="name"` plus `data-track-*` properties on links. Any other link to another site sends `outbound` {host}. Without Umami, every call does nothing.
- Add an event only when it answers a real question. Add it to `TrackEvent` and to this table. Use kebab-case names and small properties. Never send message text, names or emails.

| Event | Where | Why |
|---|---|---|
| `muse-download` {version, from: top/step/end} | /muse download links | The main product conversion, and which button works |
| `muse-source` | /muse GitHub links | Interest from developers |
| `muse-board` {board} | /muse Amazon board links | Which hardware people buy |
| `reply-sent` | /reply, on success only | Contact conversion |
| `dj-request-sent` | /dj, on success only | Engagement with the channel |
| `chat-open` | the chat opened, once per visit | Demand for chat or support (conversations themselves are counted in Chatwoot) |
| `listen-live` | starting the live stream (any button) | Audience for live sets |
| `outbound` {host} | any other external link | Where visitors go next |

Not tracked: hovers, scroll depth, palette or menu opens, theme toggles, every chat message, or anything on /admin (it has its own layout, without the script).

Worth setting up in Umami later (server side): goals or funnels for /muse → `muse-download`, and /reply → `reply-sent`.

## Support chat (Chatwoot)

**OpenClaw is deprecated.** It is not part of the architecture. Don't build anything on it, and don't treat it as the AI backend.

Status: **built.** API inbox "huismax.com live chat" (id 2, identifier `riwdAsAJffyUNYbe9imTL1oj`). The chat is the homepage's own `chat_` section (`client/lib/talk.ts`), live both ways: Chatwoot's public client API for an **API-channel inbox** (`CHATWOOT_INBOX_ID` in `wrangler.jsonc` `vars`) and its websocket `/cable`. Max answers from Chatwoot (phone app notifications). Until `CHATWOOT_INBOX_ID` is set, the chat buttons open Chatwoot's widget for the website inbox ("huismax.com", id 1, `CHATWOOT_WEBSITE_TOKEN`, `client/lib/support.ts`); with neither, /reply.

- No away messages, reply-time promises or "AI" wording on the site: it's Max, live.
- Chatwoot's websocket events used: `message.created`, `message.updated`, `conversation.typing_on/off`. Private notes and activity messages are never shown.

The old OpenClaw "AI assistant" chat (its client, `/api/chat`, `bridge/`, `CHAT_BRIDGE_URL` / `CHAT_BRIDGE_SECRET`) has been removed from the repo. The two Worker variables can be deleted in the Cloudflare dashboard.

## Open tools (homepage tools_)

Services on the server that visitors can use without an account, listed in `/admin` → homelab → open tools. Only things safe for strangers, each isolated from Max's data, resource-limited and rate-limited at Cloudflare. Never: n8n, Chatwoot, Mautic, ERPNext/Odoo, Nextcloud admin, Grafana editing, Homepage, Proxmox, or anything that runs user code on the host. Today: MiroTalk (meet.huismax.com, `{room}` links), Excalidraw (draw.huismax.com), IT-Tools (tools.huismax.com), Stirling-PDF (pdf.huismax.com, 50 MB), PrivateBin (paste.huismax.com, pastes expire within a week).

Plan:
1. Chatwoot is the conversation and support platform: a Website inbox on chat.huismax.com, with Max (and later others) answering from Chatwoot.
2. Done: the site keeps its own "chat" buttons and look, with Chatwoot's launcher hidden (`hideMessageBubble`).
3. Human takeover is how Chatwoot works anyway. When an AI responder comes, it is an Agent Bot that hands the conversation to a person (status → open) whenever it should.
4. Later: an AI responder through n8n (Chatwoot webhook → n8n → a current AI backend → reply through the Chatwoot API), set up by Server Claude.
5. Done: the legacy chat code is gone. Server Claude still has to retire the bridge service and its tunnel route (see below).

Public config: `CHATWOOT_WEBSITE_TOKEN` in `wrangler.jsonc` `vars` (the base URL is `https://chat.huismax.com`).

## Marketing (Mautic)

Nothing feeds Mautic yet, and /reply messages and DJ requests are personal messages, not leads. The first good use would be a "tell me about new Muse Companion releases" signup on /muse: the worker posts it to an n8n webhook, n8n adds the Mautic contact and handles double opt-in.

## Open server requests

- Chatwoot outgoing email: no SMTP yet, so visitors who leave an email don't get replies by email. Recommended: Resend SMTP (the site already uses Resend for /reply), sender `no-reply@huismax.com`. Waiting on Max.
- `/v1/host`: the physical machine's model, RAM, drives and network (one-off read on the Proxmox host), plus `serverId` going live (for the homelab_ sparklines). The card shows cores only, no threads.
- Cloudflare hostnames for draw., tools., pdf. and paste.huismax.com.
- Retire the OpenClaw chat bridge (`chat-bridge` service on 127.0.0.1:8790) and its tunnel hostname `chat-bridge.huismax.com`: the site no longer calls it.
- Later: n8n → Chatwoot AI responder.

Done on the server (2026-10-13): `GET https://api.huismax.com/v1/host` (the homepage's homelab_ card; the server is an Ubuntu VM on Proxmox, so no CPU temperature or RAM type); Penpot at https://design.huismax.com and Mautic at https://mautic.huismax.com with secure cookies (n8n too), so all three only log in over their https domains.

Chatwoot inbox settings (done): widget colour `#737373` (readable in both themes), "hi, it's max" welcome, reply time "in a few hours", business hours off (so the away message never shows), and a pre-chat form with one optional email field. "Powered by Chatwoot" stays: hiding it is a paid feature, and site CSS can't reach into the iframe.
