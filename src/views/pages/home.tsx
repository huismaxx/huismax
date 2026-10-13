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

export const Home = ({ live, presence, spotifyConnected, settings, identities, projects, now }: Props) => {
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
              <button type="button" class="home-chat" data-chat-open aria-haspopup="dialog" aria-expanded="false">
                <span class="home-chat-dot" aria-hidden="true" />
                chat with max's ai assistant <span aria-hidden="true">→</span>
              </button>
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
    </>
  );
};
