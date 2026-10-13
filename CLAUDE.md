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

Status: **planned**, waiting on a website ID (see open requests).

- The script loads in `src/views/layout.tsx` with `defer` and `data-domains="huismax.com"`, so local dev and branch previews aren't counted. It is only added when `UMAMI_WEBSITE_ID` is set.
- The router (`client/lib/router.ts`) navigates with `pushState`, and Umami counts those page views on its own. Check that the title it records is the new page's title, not the old one.
- Events go through one typed helper (`client/lib/track.ts`), so the event names live in one place. When Umami is missing it does nothing.
- Referrers and `utm_*` are recorded by Umami automatically, so there's no extra code for campaigns.
- Use kebab-case names and small properties. Never send message text, names or emails.

Events worth tracking. Keep the list short; each one should answer a real question.

| Event | Where | Why |
|---|---|---|
| `muse-download` {version} | /muse download button | The main product conversion |
| `muse-source` | /muse GitHub link | Interest from developers |
| `muse-board` {board} | /muse Amazon board links | Which hardware people buy |
| `reply-sent` | /reply, on success only | Contact conversion |
| `dj-request-sent` | /dj, on success only | Engagement with the channel |
| `chat-start` | first message of a chat session | Demand for chat or support |
| `listen-live` | any `[data-listen-live]` / play live | Audience for live sets |
| `outbound` {label} | footer and profile links | Where visitors go next |

Not tracked: hovers, scroll depth, palette or menu opens, theme toggles, every chat message, or anything on /admin.

## Support chat (Chatwoot)

Status: **needs Max's decision.** The header's "live chat" button opens the site's own chat panel (`client/lib/chat.ts`), which talks to the OpenClaw `website` agent through `bridge/`. Recommended direction: Chatwoot becomes the inbox and conversation layer, and OpenClaw answers inside it as a Chatwoot Agent Bot, wired up on the server or through n8n, with a human able to take over. The site keeps its own button and panel styling and opens the Chatwoot widget with its launcher hidden (`hideMessageBubble`), so it doesn't look like a generic widget. Once that works, the custom bridge can be retired.

## Marketing (Mautic)

Nothing feeds Mautic yet, and /reply messages and DJ requests are personal messages, not leads. The first good use would be a "tell me about new Muse Companion releases" signup on /muse: the worker posts it to an n8n webhook, n8n adds the Mautic contact and handles double opt-in.

## Open server requests

- Umami: create the huismax.com website and send back its website ID. Confirm `https://analytics.huismax.com/script.js` is publicly reachable.
- Chatwoot: on hold until the chat decision. Then a Website inbox and its website token.
