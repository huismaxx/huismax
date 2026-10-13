import type { Child } from 'hono/jsx';
import type { LiveStatus } from '../../lib/live';
import type { Presence } from '../../lib/presence';
import type { Item, Settings } from '../../lib/cms';
import { LiveMark } from '../components/live';
import { Listening } from '../components/listening';
import { extAttrs, isOpen } from '../components/site';

type Props = {
  live: LiveStatus;
  presence: Presence;
  spotifyConnected: boolean;
  settings: Settings;
  identities: Item[];
  projects: Item[];
  now: Item[];
  /** open services on the server (CMS → tools) */
  tools: Item[];
  /** the live chat_ section (a Chatwoot API inbox is configured) */
  talk: boolean;
};

const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/** "WHO IS MAX?" → "WHO IS" / "MAX?": the last word gets its own line, a trailing "?" tilts on hover. */
function Headline({ text }: { text: string }) {
  const cut = text.lastIndexOf(' ');
  const lines = cut > 0 ? [text.slice(0, cut), text.slice(cut + 1)] : [text];
  const last = lines.length - 1;
  return (
    <h1 class="who" data-typewriter>
      {lines.map((l, i) =>
        i === last && l.endsWith('?') ? (
          <span class="who-line">
            {l.slice(0, -1)}
            <span class="who-q">?</span>
          </span>
        ) : (
          <span class="who-line">{l}</span>
        ),
      )}
    </h1>
  );
}

/** A small link beside an identity: its own meta link, or (for the vibe coder) the first public project with a link. */
function sideLink(id: Item, project: Item | undefined) {
  const url = s(id.meta_url);
  if (url) return { text: s(id.meta) || url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), url };
  const coder = id.id === 'vibe-coder' || id.href === '/vibe-coder';
  if (coder && project && s(project.url) && !s(id.meta)) return { text: s(project.name), url: s(project.url) };
  return null;
}

export const Home = ({ live, presence, spotifyConnected, settings, identities, projects, now, tools, talk }: Props) => {
  const project = projects.find((p) => s(p.url));
  // a row never leads to a page the admin has hidden
  const rows = identities.filter((id) => isOpen(settings, s(id.href)));
  const open = (href: string) => isOpen(settings, href);
  const Cell = ({ href, children }: { href: string; children?: Child }) =>
    open(href) ? (
      <a class="index-cell" data-prox href={href}>
        {children}
      </a>
    ) : (
      <div class="index-cell" data-prox>
        {children}
      </div>
    );
  // Max's own work only (CMS → projects, the vibe coder list); the homelab's tools live on /homelab
  const work = projects.map((p) => ({ name: s(p.name), url: s(p.url), status: s(p.status), note: s(p.note) }));

  return (
    <>
      {/* code rain behind the whole homepage (client/pages/home.ts) */}
      <canvas class="rain" data-rain aria-hidden="true" />
      <section class="home-hero" data-mood="none">
        <div class="hero-inner">
          <div class="who-wrap">
            <Headline text={settings.headline} />
            {settings.tagline && <p class="who-tagline">{settings.tagline}</p>}
            <div class="home-actions">
              {/* Max's open-source ESP32 project (Muse Companion): the how-to page, which links the source */}
              <a class="home-chat home-perk" href="/muse">
                <span class="home-perk-tag">open source</span> build your own muse gadget <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
          {/* personal state + what's playing; a live DJ session overrides both and they return when it ends */}
          <div class="presence" data-presence data-live={live.isLive ? 'on' : 'off'} aria-live="polite">
            <p class="presence-line presence-off">
              <span class="doing-dot" aria-hidden="true" />
              <span data-presence-status>{presence.status}</span>
            </p>
            <Listening class="presence-off" feature pending={spotifyConnected} />
            {/* the line set by hand in /admin; CSS hides it while Spotify shows a track */}
            <p class="presence-sub presence-off mono" data-presence-listen hidden={!presence.listening}>
              {presence.listening ? `♪ ${presence.listening.title}${presence.listening.artist ? ` — ${presence.listening.artist}` : ''}` : ''}
            </p>
            {settings.spotifyProfile && (
              <a class="presence-profile presence-off mono" href={settings.spotifyProfile} target="_blank" rel="noopener noreferrer">
                spotify profile <span aria-hidden="true">↗</span>
              </a>
            )}
            <p class="presence-line presence-on">
              <LiveMark live={live} />
            </p>
            {/* live: the DJ console's spectrum where the album art was (client/pages/home.ts); the card opens the channel */}
            {settings.pages.dj && (
              <a class="listening listening-feature presence-on" href="/dj" data-live-card>
                <span class="listening-art" aria-hidden="true">
                  <canvas class="live-viz" data-live-viz />
                </span>
                <span class="listening-text">
                  <span class="listening-state mono dim">on air</span>
                  <span class="listening-name">huismax dj channel</span>
                  <span class="listening-artist" data-live-session>{live.sessionTitle ?? ''}</span>
                  {/* the song playing on Spotify (client/pages/home.ts) */}
                  <span class="listening-artist" data-live-song />
                </span>
                {/* the line being sung on the stream (client/pages/home.ts), as under the Spotify card */}
                <span class="listening-lyric" data-listening-lyric aria-hidden="true" hidden>
                  <span class="listening-lyric-text" data-listening-lyric-text />
                </span>
              </a>
            )}
          </div>
          <div class="hero-side">
            {rows.length > 0 && (
              <ol class="identities" data-identities>
                {rows.map((id, i) => {
                  const side = sideLink(id, project);
                  return (
                    <li>
                      <a class="identity" href={s(id.href)} {...extAttrs(s(id.href))} data-mood-key={s(id.id)} data-caption={s(id.caption)}>
                        <span class="identity-idx mono">{String(i + 1).padStart(2, '0')}</span>
                        <span class="identity-name">{s(id.name)}</span>
                        <span class="identity-meta mono">{side ? '' : s(id.meta)}</span>
                        <span class="identity-arrow" aria-hidden="true">→</span>
                      </a>
                      {/* a sibling, not nested: the row goes to its page, the small link goes out */}
                      {side && (
                        <a class="identity-ext mono" href={side.url} target="_blank" rel="noopener noreferrer">
                          {side.text} <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            <p class="mood-caption mono" data-mood-caption aria-hidden="true" />
          </div>
        </div>
      </section>

      <section class="home-index" aria-label="index">
        <Cell href="/now">
          <span class="index-label mono">now_</span>
          <ul class="index-list">
            <li>
              <span class="mono dim">right now</span> <span data-presence-status>{presence.status}</span>
            </li>
            {now.map((n) => (
              <li>
                {s(n.label) && <span class="mono dim">{s(n.label)}</span>} {s(n.text)}
              </li>
            ))}
          </ul>
        </Cell>
        {/* the physical server as a whole, filled from /api/homelab/host (client/pages/home-host.ts); stays hidden without data */}
        {open('/homelab') && (
          <a class="index-cell index-host" data-prox href="/homelab" data-host hidden>
            <span class="index-label mono">
              homelab_ <span class="host-health" data-host-health />
            </span>
            <span class="host-name">
              <span class="index-big" data-host-name />
              <span class="mono dim" data-host-model />
            </span>
            <dl class="host-specs" data-host-specs />
            <dl class="host-live" data-host-live />
          </a>
        )}
        {work.length > 0 && (
          <div class="index-cell index-projects" data-prox>
            <span class="index-label mono">projects_</span>
            <ul class="project-list">
              {work.map((p) => {
                const inner = (
                  <>
                    <span class="project-row">
                      <span class="project-name">
                        {p.name}
                        {p.url && <span aria-hidden="true"> ↗</span>}
                      </span>
                      {p.status && <span class="project-status mono dim">{p.status}</span>}
                    </span>
                    {p.note && <span class="project-note dim">{p.note}</span>}
                  </>
                );
                return (
                  <li>
                    {p.url ? (
                      <a class="project-item" href={p.url} {...extAttrs(p.url)}>
                        {inner}
                      </a>
                    ) : (
                      <span class="project-item">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* services on Max's server anyone can use, no account; status and the {room} links come from client/pages/home-tools.ts */}
      {tools.length > 0 && (
        <section class="home-block home-tools" aria-labelledby="tools-label" data-tools>
          <div class="block-head">
            <h2 id="tools-label" class="index-label mono">tools_</h2>
            <p class="block-intro">Things running on my server that you can use right now. Free, no account.</p>
          </div>
          <ul class="tool-list">
            {tools.map((t) => (
              <li class="tool" data-tool={s(t.id)}>
                <span class="tool-status mono" data-tool-status aria-live="polite">
                  <span class="tool-dot" aria-hidden="true" />
                  <span data-tool-state>checking</span>
                </span>
                <span class="tool-name">{s(t.name)}</span>
                <span class="tool-desc dim">{s(t.description)}</span>
                <a class="home-chat tool-go" href={s(t.url).replace(/\{room\}.*$/, '').replace(/join\/$/, '')} data-tool-url={s(t.url)} target="_blank" rel="noopener noreferrer">
                  {s(t.action) || 'open'} <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* the live chat with Max (client/lib/talk.ts): his phone gets every message, his replies arrive here */}
      {talk && (
        <section id="chat" class="home-block home-talk" aria-labelledby="chat-label" data-talk>
          <div class="block-head">
            <h2 id="chat-label" class="index-label mono">chat_</h2>
            <p class="block-intro">Message me here. It goes straight to my phone, and when I answer it shows up right here, live.</p>
            <p class="talk-status mono">
              <span class="doing-dot" aria-hidden="true" /> <span data-talk-status>live</span>
            </p>
          </div>
          <div class="talk">
            <p class="talk-empty dim" data-talk-empty hidden>
              no messages yet. say hi.
            </p>
            <ol class="talk-log" data-talk-log role="log" aria-live="polite" aria-label="conversation with max" />
            <p class="talk-typing mono dim" data-talk-typing hidden>
              max is typing<span class="talk-dots" aria-hidden="true" />
            </p>
            <p class="talk-error mono" data-talk-error role="alert" hidden />
            <form class="talk-form" data-talk-form>
              <label class="sr-only" for="talk-input">message max</label>
              <textarea id="talk-input" rows={1} maxlength={1000} placeholder="message max" autocomplete="off" enterkeyhint="send" />
              <button type="submit" class="talk-send mono">
                send <span aria-hidden="true">→</span>
              </button>
            </form>
            <p class="talk-note mono dim">kept in this browser, so you can come back to it.</p>
          </div>
        </section>
      )}
    </>
  );
};
