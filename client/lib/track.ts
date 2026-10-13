/**
 * Umami events (analytics.huismax.com). Page views, referrers and utm_* are Umami's own, router navigations
 * included (it follows pushState). This file only adds the few events that answer a real question; the list and
 * the reasons are in CLAUDE.md. Never put message text, names or emails in an event.
 *
 * Without Umami (no website ID, blocked, still loading, local dev) every call does nothing.
 */

type Props = Record<string, string | number>;

declare global {
  interface Window {
    umami?: { track(name: string, data?: Props): unknown };
  }
}

export type TrackEvent =
  | 'muse-download' // { version, from }
  | 'muse-source'
  | 'muse-board' // { board }
  | 'reply-sent'
  | 'dj-request-sent'
  | 'chat-start' // a visitor's first message
  | 'listen-live'
  | 'outbound'; // { host }

export function track(name: TrackEvent, data?: Props) {
  try {
    window.umami?.track(name, data);
  } catch {
    /* analytics never breaks the page */
  }
}

/** `data-track-version="0.4.6"` → { version: '0.4.6' } */
const propsOf = (el: HTMLElement): Props | undefined => {
  const out: Props = {};
  for (const [k, v] of Object.entries(el.dataset)) {
    if (k.startsWith('track') && k.length > 5 && v) out[k[5].toLowerCase() + k.slice(6)] = v;
  }
  return Object.keys(out).length ? out : undefined;
};

/**
 * Links: `[data-track="name"]` (with `data-track-*` properties) sends that event; any other link to another site
 * sends `outbound` with its host. Middle clicks count too. Nothing is delayed or prevented.
 */
export function startTracking() {
  const onClick = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href]');
    if (!a) return;
    const name = a.dataset.track as TrackEvent | undefined;
    if (name) return track(name, propsOf(a));
    let url: URL;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return;
    }
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.origin !== location.origin) track('outbound', { host: url.hostname });
  };
  document.addEventListener('click', onClick, { capture: true, passive: true });
  document.addEventListener('auxclick', onClick, { capture: true, passive: true });
}
