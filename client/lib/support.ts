import { currentTheme } from './theme';
import { track } from './track';

/**
 * Live chat through Chatwoot (chat.huismax.com). The site keeps its own [data-chat-open] buttons; Chatwoot's
 * launcher is hidden and its window is styled as the site's side panel (chat.css). Without a website token (local
 * dev, branch previews) the buttons lead to /reply.
 *
 * The SDK (and the widget iframe it brings) loads on intent only: hover, focus or a click on a chat button, or at
 * idle when this browser already has a conversation, so replies show up. If Chatwoot can't be reached the button
 * leads to /reply instead, so a visitor always has a way to reach Max.
 */

const BASE = 'https://chat.huismax.com';
const READY_TIMEOUT = 12_000;
const OPENED_KEY = 'huismax:chat-opened';

type Chatwoot = {
  toggle(state?: 'open' | 'close'): void;
  setColorScheme(scheme: 'light' | 'dark' | 'auto'): void;
  isOpen?: boolean;
};

declare global {
  interface Window {
    chatwootSettings?: Record<string, unknown>;
    chatwootSDK?: { run(cfg: { websiteToken: string; baseUrl: string }): void };
    $chatwoot?: Chatwoot;
  }
}

export function startSupport(token: string, navigate: (href: string) => void) {
  let state: 'idle' | 'loading' | 'ready' | 'failed' = token ? 'idle' : 'failed';
  let wantOpen = false;
  let open = false;
  let timer = 0;

  const sync = (root: ParentNode = document) => {
    for (const b of root.querySelectorAll<HTMLElement>('[data-chat-open]')) {
      b.setAttribute('aria-expanded', String(open));
      b.toggleAttribute('aria-busy', state === 'loading' && wantOpen);
    }
  };

  const fail = () => {
    if (state === 'ready' || state === 'failed') return;
    state = 'failed';
    clearTimeout(timer);
    sync();
    if (wantOpen) navigate('/reply');
    wantOpen = false;
  };

  const load = () => {
    if (state !== 'idle') return;
    state = 'loading';
    window.chatwootSettings = {
      hideMessageBubble: true,
      showPopoutButton: false,
      position: 'right',
      type: 'standard',
      locale: 'en',
      darkMode: currentTheme() === 'dark' ? 'dark' : 'light',
    };
    const s = document.createElement('script');
    s.src = `${BASE}/packs/js/sdk.js`;
    s.async = true;
    s.onload = () => {
      try {
        window.chatwootSDK!.run({ websiteToken: token, baseUrl: BASE });
      } catch {
        fail();
      }
    };
    s.onerror = fail;
    document.head.append(s);
    timer = window.setTimeout(fail, READY_TIMEOUT);
  };

  // a slow load that already sent the visitor to /reply still counts: the next click opens the chat
  addEventListener('chatwoot:ready', () => {
    state = 'ready';
    clearTimeout(timer);
    if (wantOpen) window.$chatwoot?.toggle('open');
    wantOpen = false;
    sync();
  });
  addEventListener('chatwoot:error', () => fail());
  addEventListener('chatwoot:opened', () => {
    open = true;
    document.documentElement.classList.add('chat-open');
    sync();
    // once per visit: demand for chat (the conversations themselves are counted in Chatwoot)
    try {
      if (sessionStorage.getItem(OPENED_KEY)) return;
      sessionStorage.setItem(OPENED_KEY, '1');
    } catch {
      /* private mode: count it anyway */
    }
    track('chat-open');
  });
  addEventListener('chatwoot:closed', () => {
    open = false;
    document.documentElement.classList.remove('chat-open');
    sync();
  });
  addEventListener('themechange', () => {
    try {
      window.$chatwoot?.setColorScheme(currentTheme());
    } catch {
      /* not loaded yet: the next load reads the theme */
    }
  });

  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest?.<HTMLElement>('[data-chat-open]');
    if (!b) return;
    e.preventDefault();
    if (state === 'failed') return navigate('/reply');
    if (state === 'ready') return window.$chatwoot?.toggle(open ? 'close' : 'open');
    wantOpen = true;
    load();
    sync();
  });
  // warm up on intent, so the click opens at once
  const warm = (e: Event) => (e.target as Element).closest?.('[data-chat-open]') && load();
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);
  // Esc on the page (focus outside the widget's iframe) closes it too
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && !e.isComposing) window.$chatwoot?.toggle('close');
  });

  // A conversation already going in this browser: load quietly so replies arrive.
  if (/(?:^|;\s*)cw_conversation=/.test(document.cookie)) {
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 2000));
    idle(load);
  }

  return { sync };
}
