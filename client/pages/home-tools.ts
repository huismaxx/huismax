import { $, $$, type Scope } from '../lib/dom';

/**
 * The homepage's tools_: whether each one is up (from /api/tools, which checks about once a minute), and a fresh
 * random room for links with {room} (a video call nobody else lands in by accident).
 */

const WORDS = ['amber', 'basil', 'cedar', 'delta', 'ember', 'fjord', 'grove', 'harbor', 'indigo', 'juniper', 'koi', 'lumen', 'maple', 'nova', 'orbit', 'pine', 'quartz', 'river', 'sable', 'tide', 'umber', 'velvet', 'willow', 'zephyr'];
const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
const room = () => `${pick()}-${pick()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5)}`;

export function startTools(main: HTMLElement, scope: Scope) {
  const root = $('[data-tools]', main);
  if (!root) return;

  // a new room on every click (set just before the browser follows the link)
  for (const a of $$<HTMLAnchorElement>('[data-tool-url*="{room}"]', root)) {
    const fresh = () => (a.href = a.dataset.toolUrl!.replace('{room}', room()));
    scope.on(a, 'pointerdown', fresh);
    scope.on(a, 'keydown', (e: KeyboardEvent) => e.key === 'Enter' && fresh());
    scope.on(a, 'click', fresh);
  }

  const paint = (list: { id: string; up: boolean }[]) => {
    for (const li of $$('[data-tool]', root)) {
      const st = list.find((t) => t.id === li.dataset.tool);
      li.dataset.up = st ? String(st.up) : '';
      $('[data-tool-state]', li)!.textContent = !st ? '—' : st.up ? 'online' : 'offline';
    }
  };
  let alive = true;
  scope.add(() => (alive = false));
  fetch('/api/tools', { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((b: { tools?: { id: string; up: boolean }[] } | null) => alive && paint(b?.tools ?? []))
    .catch(() => alive && paint([]));
}
