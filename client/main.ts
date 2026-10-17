import { $, readJSON, Scope } from './lib/dom';
import { proximity } from './lib/proximity';
import { spotify } from './lib/spotify';
import { paintListening } from './lib/listening';
import { paintLive, startLivePolling } from './lib/live';
import { startRouter } from './lib/router';
import { startPalette } from './lib/palette';
import { startMenu } from './lib/menu';
import { startTalk } from './lib/talk';
import { startAudioBar, playLive } from './lib/audiobar';
import { startTracking } from './lib/track';
import { initHome } from './pages/home';
import { initAlbum } from './pages/album';
import { initDJ } from './pages/dj';
import { initCoder } from './pages/coder';
import { initMusic } from './pages/music';
import { initIdeas } from './pages/ideas';
import { initReply } from './pages/reply';
import { initNotFound } from './pages/notfound';
import { initHomelab } from './pages/homelab';

export type PageInit = (main: HTMLElement, scope: Scope, nav: (href: string) => void) => void;

const pages: Record<string, PageInit> = {
  home: initHome,
  photographer: initAlbum,
  hiking: initAlbum,
  dj: initDJ,
  'vibe-coder': initCoder,
  music: initMusic,
  reply: initReply,
  ideas: initIdeas,
  homelab: initHomelab,
  'not-found': initNotFound,
};

let scope = new Scope();

function mount(main: HTMLElement) {
  scope = new Scope();
  paintLive(main);
  chat?.sync(main);
  // Staggered entrance for anything marked [data-reveal] or list rows, via CSS.
  main.classList.add('is-entering');
  requestAnimationFrame(() => requestAnimationFrame(() => main.classList.remove('is-entering')));
  proximity(main, scope);
  scope.add(spotify.subscribe((n) => paintListening(main, n)) as () => void);
  pages[main.dataset.page ?? '']?.(main, scope, router.navigate);
}

const router = startRouter({
  beforeSwap: () => scope.dispose(),
  afterSwap: mount,
});

startPalette(router.navigate);
startMenu(router.navigate);
// The live chat with Max (homepage chat_, Chatwoot behind it). Without an inbox the header's chat is a link to /reply.
const inbox = readJSON<{ inbox?: string }>('chat-config')?.inbox;
const chat = inbox ? startTalk(inbox, router.navigate) : null;
startAudioBar(router.navigate);
startLivePolling();
startTracking();

// Any [data-listen-live] button on any page starts the live stream in the global player.
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest?.('[data-listen-live]')) playLive();
});

mount($('main')!);
