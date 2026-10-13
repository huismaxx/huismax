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
| Chatwoot | https://chat.huismax.com | Customer support and website chat, later AI-assisted. Use its widget, styled to match huismax. Don't build a support backend. |
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

Status: **built, waiting on the website ID.** Until `UMAMI_WEBSITE_ID` is set, pages carry no analytics.

- `src/views/layout.tsx` adds `https://analytics.huismax.com/script.js` (`defer`, `data-domains="huismax.com"`) only when `UMAMI_WEBSITE_ID` (a UUID, in `wrangler.jsonc` `vars`) is set. So local dev and branch previews (which get no vars) aren't counted. The ID is public; commit it in `wrangler.jsonc`, since a value there overrides one set in the dashboard on every deploy.
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
| `chat-start` | first message of a chat session | Demand for chat or support |
| `listen-live` | starting the live stream (any button) | Audience for live sets |
| `outbound` {host} | any other external link | Where visitors go next |

Not tracked: hovers, scroll depth, palette or menu opens, theme toggles, every chat message, or anything on /admin (it has its own layout, without the script).

Worth setting up in Umami later (server side): goals or funnels for /muse → `muse-download`, and /reply → `reply-sent`.

## Support chat (Chatwoot)

**OpenClaw is deprecated.** It is not part of the architecture. Don't build anything on it, and don't treat it as the AI backend.

The current "live chat" (`client/lib/chat.ts`, `client/lib/assistant-api.ts`, `src/lib/chat.ts`, `/api/chat`, `bridge/`, `CHAT_BRIDGE_URL` / `CHAT_BRIDGE_SECRET`) is **legacy**. It stays until Chatwoot replaces it, then it gets removed. Don't add features to it.

Plan:
1. Chatwoot is the conversation and support platform: a Website inbox on chat.huismax.com, with Max (and later others) answering from Chatwoot.
2. The site keeps its own header "live chat" button and look. It loads the Chatwoot SDK lazily (on the first click, or when idle), sets `hideMessageBubble: true` so Chatwoot's launcher never shows, and opens the widget with `$chatwoot.toggle('open')`. The widget's colour, position and greeting follow huismax (dark/light, Geist).
3. Human takeover is how Chatwoot works anyway. When an AI responder comes, it is an Agent Bot that hands the conversation to a person (status → open) whenever it should.
4. Later: an AI responder through n8n (Chatwoot webhook → n8n → a current AI backend → reply through the Chatwoot API), set up by Server Claude.
5. Once Chatwoot works on the site, remove the legacy chat code, `/api/chat`, `bridge/` and its env vars, and ask Server Claude to retire the bridge service and its tunnel route.

Public config: `CHATWOOT_WEBSITE_TOKEN` in `wrangler.jsonc` `vars` (the base URL is `https://chat.huismax.com`). `chat-start` keeps meaning "a visitor started a conversation".

## Marketing (Mautic)

Nothing feeds Mautic yet, and /reply messages and DJ requests are personal messages, not leads. The first good use would be a "tell me about new Muse Companion releases" signup on /muse: the worker posts it to an n8n webhook, n8n adds the Mautic contact and handles double opt-in.

## Open server requests

- Umami: create the huismax.com website, send back its ID, and confirm the script and collect endpoint are public (sent).
- Chatwoot: a Website inbox for huismax.com, its website token, the allowed domain, and confirmation that the SDK and widget can be embedded (sent).
