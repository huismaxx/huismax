# huismax

Personal site. Hono on Cloudflare Workers + static assets, vanilla TS on the client. Free tier only.

```
npm install
cp .dev.vars.example .dev.vars
npm run dev          # http://localhost:8787  (add ?live=1 to any page to fake a live session)
npm run typecheck
npm run deploy       # wrangler deploy (builds the client first)
```

## Layout

```
src/              worker (server-rendered pages + API)
  index.tsx       routes
  lib/live.ts     live status: mock → KV override → env vars
  lib/spotify.ts  Spotify OAuth + now playing / recent (tokens never leave the worker)
  lib/lyrics.ts   lyrics of the song playing, from LRCLIB (search, pick the recording, parse LRC)
  lib/cms.ts      CMS collections, field rules, settings (D1)
  lib/db.ts       applies migrations/ and the first content from inside the worker
  lib/content.ts  what the public pages read (falls back to defaults if D1 is down)
  lib/media.ts    uploaded images in R2: type sniffing, safe keys, /media/<key>
  lib/reply.ts    /reply messages: stored in D1, emailed with Resend
  lib/requests.ts /dj requests for the next live set (D1, published in /admin)
  lib/homelab.ts  /homelab and the homepage's homelab_ card: the Monitoring API (or demo data), cleaned up, cached, assessed
  views/          layout, components, pages
client/           browser code, bundled by scripts/build.mjs into public/assets
  lib/router.ts   same-origin navigation that swaps <main> only (keeps audio playing)
  lib/player.ts   the single global <audio>; spectrum via Web Audio when the source allows CORS
  lib/menu.ts     the Menu overlay
  lib/palette.ts  hidden ⌘K / "/" command palette (easter egg)
  lib/spotify.ts  polls /api/spotify/now, extrapolates progress between polls
  lib/lyrics.ts   the song's lyrics and which line is being sung (from the same progress)
  pages/          per-page behaviour
  styles/         tokens → base → layout → components → pages
public/           static files served as-is
```

## Content (CMS)

Everything on the site is edited in `/admin`: homepage text and identities, projects, music sections, photos (photographer and hiking), now, DJ sessions and requests, reply inbox, links, page and menu visibility. Nothing content-related lives in the source.

- Structured content is in D1 (`DB`), photos and DJ covers in R2 (`MEDIA`). Both are created automatically on the first deploy, like the KV namespace. R2 has to be enabled once on the Cloudflare account (R2 → Get started) or the deploy fails.
- The worker applies `migrations/*.sql` itself (tracked in `d1_migrations`, the same table `wrangler d1 migrations apply` uses), then writes the first content once. Migrations only ever add; never edit an applied one, add the next `000N_….sql` and list it in `src/lib/db.ts`.
- Photos are resized and re-encoded in the browser before upload (which also drops EXIF/GPS). The worker checks the real file type and size and names the files itself. Unpublished photos are only visible to the admin.
- /photographer and /hiking show seven empty frames (NOT 1 … NOT 7) that published photos fill in order.

## Admin, status and live

`/admin` (not linked anywhere, noindex). Password = the `ADMIN_TOKEN` secret.

- **status**: presets (locked in, afk, touching grass…) or any custom text; shown under the identities on the homepage.
- **♪ spotify**: connect once; the site then shows what's playing (or last played) with the album artwork.
- **huismax dj channel**: live replaces the status with `● LIVE / huismax dj channel` everywhere; when it ends the status comes back. The radio makes it live on its own (below); this switch is for any other stream, and its session title also names radio sessions.

Status and live are stored in the `STATE` KV namespace (created automatically on first deploy). Public pages poll `GET /api/presence` every 15s, so changes show up within about a minute (KV is eventually consistent across regions).

Scripts / shortcuts can write with `Authorization: Bearer <ADMIN_TOKEN>`:

```
curl -X POST https://<site>/api/live-status -H "Authorization: Bearer $TOKEN" \
  -d '{"isLive":true,"sessionTitle":"late set","streamUrl":"https://…/stream.mp3"}'
curl -X POST https://<site>/api/admin/presence -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"probably coding","listening":{"title":"Japanese Denim","artist":"Daniel Caesar"}}'
```

`GET /api/live-status` stays available on its own.

## Radio

The DJ channel's own radio is Icecast at radio.huismax.com, fed by BUTT. The site is live while Icecast has the `/live.mp3` mount, so starting BUTT goes live and stopping it ends the session. The site notices within about 15–30 s.

- Browsers play `RADIO_STREAM_URL` (in `wrangler.jsonc` vars) straight from Icecast. The worker never carries audio.
- The worker reads `status-json.xsl` next to the stream (or `RADIO_STATUS_URL`) in `src/lib/radio.ts`. It shares the answer at the edge for 10 s and waits at most 2.5 s. Anything unclear counts as off air.
- `GET /api/dj-status` → `{ live, listeners }`. The DJ page polls it every 15 s for the listener count, and `/api/presence` carries the same live state to every page.
- The stream should send `Access-Control-Allow-Origin: https://huismax.com` (it does). That lets the visualizer read the real audio and lets volume work on iOS. Without it the stream still plays.

## Spotify

1. Spotify Developer Dashboard → your app → Settings → Redirect URIs: add `https://huismax.com/api/spotify/callback` (and `http://127.0.0.1:8787/api/spotify/callback` for local dev).
2. `SPOTIFY_CLIENT_ID` is public and lives in `wrangler.jsonc` → `vars`. Cloudflare → the Worker → Settings → Variables and Secrets: add `SPOTIFY_CLIENT_SECRET` as type **Secret** (runtime, not the Build section). `/admin` names any variable the worker can't see.
3. Open `/admin` → ♪ spotify → connect. The refresh token is kept in KV; nothing token-related is ever sent to the browser.

Public endpoints (edge-cached, safe to poll):

- `GET /api/spotify/now` → `{ state: playing | paused | recent | idle | unconfigured | disconnected | error, track? }`, track = name, artists, album, artwork, url, durationMs, progressMs, isPlaying, playedAt.
- `GET /api/spotify/recent` → recently played (deduplicated) + on repeat (top tracks, last 4 weeks).

`/api/spotify/login`, `/api/spotify/disconnect` are admin-only; `/api/spotify/callback` only accepts a one-time state issued by login.

### Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net), which is free and needs no key, so there is nothing to set up. The full song is on /music under the progress bar; the homepage card shows the line being sung.

- **Lookup** (`src/lib/lyrics.ts`):
  1. The worker searches LRCLIB for title + first artist. If that finds nothing, it tries the bare title (without "feat.", "- Remastered", "(Live)" and similar), then a free-text search.
  2. It keeps results whose title and artist match, ignoring case, accents and punctuation.
  3. Synced lyrics are used only from a recording within 3 s of Spotify's duration. Otherwise the words are shown unsynced, or the song is marked instrumental or "none found".
- **`GET /api/spotify/lyrics?id=<spotify track id>`** answers only for the track `/api/spotify/now` reports (anything else: 409), so it can't be used as an open lyrics proxy.
- **One lookup per song.** The answer stays at the edge: a week when found, a day when nothing was found, two minutes when LRCLIB failed. It also stays in the browser, and in the page for the rest of the visit.
- **Sync:**
  1. `/api/spotify/now` carries `ageMs` (how old the edge-cached answer is). The page adds it to Spotify's `progress_ms` and to the time since the poll arrived.
  2. The current line is the last one whose start ≤ that + 250 ms.
  3. The page sleeps until the next line starts. While synced lyrics show, it polls every 10 s instead of 20 s, so a seek or skip is caught sooner.
- **While the DJ channel is live**, the lyrics follow the stream, which reaches listeners about 5 s after Max's Spotify (BUTT → Icecast → the player's buffer). The lines run `LIVE_DELAY` (5000 ms, in `client/lib/lyrics.ts`) behind while the song plays. Paused, there is no delay: the stream has caught up by then. Change that one number if the stream's latency changes.
  - /dj shows them as subtitles over the spectrum (`client/pages/dj-lyrics.ts`), hooked up only while live.
  - The homepage live card carries the same line.
  - /music says "synced to the live stream".

## Reply

`/reply` is a message form. Every message is kept in `/admin` → reply. To also get them by email:

1. resend.com → API Keys → create one. Cloudflare → the Worker → Settings → Variables and Secrets → add a **Secret** `RESEND_API_KEY`.
2. `/admin` → reply → set the address messages go to.

The sender is the `EMAIL_FROM` variable (e.g. `Max <noreply@huismax.com>`, on a domain verified in Resend), or the one set in `/admin`. Without either, Resend's test sender `onboarding@resend.dev` is used, which only delivers to the email of your Resend account. Visitors are rate limited (one a minute, ten a day, keyed by a hash of the IP) and a hidden honeypot field drops bots.

## DJ requests

`/dj` asks "What should I play next live?". Visitors send a track, artist or vibe (200 characters) and an optional name (40). `POST /api/dj/requests` keeps each one in D1 as a draft. `/admin` → dj → requests lists them newest first. Publish the ones you pick and they show on /dj under "on the list" (the newest 20). Delete the rest.

The same guards as /reply apply:
- only this site's pages can send;
- a honeypot field drops bots;
- one request a minute and five a day per visitor (a hash of the IP, counted apart from /reply);
- 30 an hour site-wide.

Hiding the DJ page in /admin also closes the form.

## Homelab

`/homelab` shows the servers: the overall status, each server's CPU, memory, storage, network, uptime and Docker containers, and history charts on `/homelab/<id>`. Under it are the self-hosted sites, which you edit in `/admin` → homelab, each with a live up/down check.

The server data comes from the Huismax Monitoring API, `MONITORING_API_URL` = `https://api.huismax.com` (in `wrangler.jsonc`; optional secret `MONITORING_API_TOKEN`). The site uses the `/v1` contract when the API has it, and the existing endpoints until then; see `MONITORING_API.md`. Without a URL (local dev) the page shows demo data, labelled as such.

- The worker asks the API, keeps only known fields and masks addresses. Answers are cached at the edge: 15 s for servers, 1–15 min for history.
- The last good answer is kept for a week; when the API stops answering, the page shows it marked "stale".
- `GET /api/homelab`, `GET /api/homelab/<id>/history?range=1h|24h|7d` and `GET /api/homelab/services` are what the page polls. They return 404 while the page is hidden in /admin.
- The homepage's `homelab_` card is the physical server as a whole (hardware, overall CPU / RAM / disk, uptime), from `GET /api/homelab/host` (the API's `/v1/host`). It stays hidden while there's no host to show.

## Analytics

Umami at analytics.huismax.com, without cookies. `UMAMI_WEBSITE_ID` in `wrangler.jsonc` `vars` is the huismax.com website's ID; empty means no analytics. Events are sent from `client/lib/track.ts`, and the list of events is in CLAUDE.md.

## Chat

The homepage's `chat_` section is a live chat with Max in the site's own design (`client/lib/talk.ts`). Chatwoot at chat.huismax.com is only the backend: the browser uses Chatwoot's public client API for an **API-channel inbox** (`CHATWOOT_INBOX_ID`, public, `wrangler.jsonc` `vars`) and its websocket (`wss://chat.huismax.com/cable`), so Max's replies and "typing…" appear the moment he sends them from Chatwoot (web or phone app, which notifies him).

- The contact and conversation are created on the first message and kept in the browser (localStorage). The socket stays open while visitors browse; a reply on another page puts a red dot on the header's `chat` button, which leads back to `/#chat`.
- If the socket can't connect, it polls every 10 s. A message that fails to send can be tapped to retry.
- Without `CHATWOOT_INBOX_ID`, the chat buttons open Chatwoot's own widget (`client/lib/support.ts`, `CHATWOOT_WEBSITE_TOKEN`); with neither, they lead to `/reply`.

## Tools

The homepage's `tools_` lists services on Max's server that anyone can use without an account (edited in `/admin` → homelab → open tools; table `tools`). Each shows whether it's up (`GET /api/tools`, checked about once a minute). A link with `{room}` (e.g. `https://meet.huismax.com/join/{room}`) gets a fresh random room on every click. Only add things that are safe for strangers: never an admin page, n8n, Chatwoot, Mautic or anything with a login to Max's data.

## Deploy from GitHub (Cloudflare dashboard)

Workers & Pages → Create → Import a repository → pick this repo.
Build command: leave empty. Deploy command: `npx wrangler deploy`. Every push to `main` deploys.

Then: the Worker → Settings → Variables and Secrets → add a **Secret** `ADMIN_TOKEN` (your admin password).
