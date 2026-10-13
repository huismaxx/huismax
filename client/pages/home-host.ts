import { h } from '../admin/h';
import { $, type Scope } from '../lib/dom';
import { sparkline } from '../lib/chart';
import { bytes, ofTotal, pct, share, uptime } from '../lib/units';
import type { Drive, Health, Host } from '../../src/lib/homelab-types';

/**
 * The homepage's homelab_ card: the physical server as a whole, from /api/homelab/host (the worker asks the
 * Monitoring API, or serves demo data). Polled every 15 s while visible. The card stays hidden until there's
 * something to show, and keeps the last picture when a poll fails.
 */

const POLL = 15_000;
const MARK: Record<Health, string> = { up: '●', degraded: '▲', down: '×' };

/** Drives are sold in decimal units: "4 TB", "512 GB". */
const sold = (n: number) => (n >= 1e12 ? `${Math.round(n / 1e11) / 10} TB` : `${Math.round(n / 1e9)} GB`);

/** One line per kind of drive, "2× 4 TB WD Red Plus HDD": the same drive once, with a count. */
function drives(list: Drive[]) {
  const groups = new Map<string, { d: Drive; n: number }>();
  for (const d of list) {
    const key = `${d.model}|${d.kind}|${d.size}`;
    const g = groups.get(key);
    g ? g.n++ : groups.set(key, { d, n: 1 });
  }
  return [...groups.values()]
    .map(({ d, n }) => [n > 1 ? `${n}×` : '', d.size ? sold(d.size) : '', d.model, d.kind].filter(Boolean).join(' '));
}

const row = (label: string, value: string | string[]) => {
  const lines = (Array.isArray(value) ? value : [value]).filter(Boolean);
  return lines.length ? h('div', null, h('dt', { class: 'mono' }, label), h('dd', null, ...lines.map((l) => h('span', null, l)))) : null;
};

const meter = (value: number | null) => {
  const el = h('span', { class: 'hl-meter', 'aria-hidden': 'true' }, h('i'));
  (el.firstChild as HTMLElement).style.transform = `scaleX(${Math.min(1, (value ?? 0) / 100)})`;
  if ((value ?? 0) >= 90) el.classList.add('is-hot');
  return el;
};
/** a figure, a small line under it, then the last hour as a sparkline (or a meter when there's no history) */
const stat = (label: string, value: string, sub: string, fill?: number | null, trend: number[] = []) =>
  h(
    'div',
    null,
    h('dt', { class: 'mono' }, label),
    h('dd', null, h('span', { class: 'host-value' }, value), sub ? h('span', { class: 'mono dim' }, sub) : null),
    trend.length > 1 ? sparkline(trend) : fill === undefined ? null : meter(fill),
  );

/** "14 cores · 20 threads", and what the VM on it gets */
function cpuLine(hw: Host['hardware']) {
  const chip = hw.cores && hw.threads && hw.threads !== hw.cores ? `${hw.cores} cores · ${hw.threads} threads` : hw.cores ? `${hw.cores} cores` : '';
  return [[hw.cpu, chip].filter(Boolean).join(' · '), hw.vcpus ? `${hw.vcpus} vCPU to the server VM` : ''];
}

function paint(card: HTMLElement, x: Host) {
  const hw = x.hardware;
  const health = $('[data-host-health]', card)!;
  health.dataset.health = x.stale ? 'down' : x.health;
  health.textContent = x.stale ? '× stale' : `${MARK[x.health]} ${x.health}${x.source === 'demo' ? ' · demo' : ''}`;
  $('[data-host-name]', card)!.textContent = x.name;
  $('[data-host-model]', card)!.textContent = hw.model;

  $('[data-host-specs]', card)!.replaceChildren(
    ...[
      row('cpu', cpuLine(hw)),
      row('memory', [hw.memory ? bytes(hw.memory) : '', hw.memoryType].filter(Boolean).join(' ')),
      row('storage', drives(hw.drives)),
      row('gpu', hw.gpu),
      row('network', hw.network),
      row('os', hw.os),
    ].filter((el): el is HTMLDivElement => !!el),
  );

  const mem = share(x.memory), disk = share(x.storage);
  $('[data-host-live]', card)!.replaceChildren(
    stat('cpu', pct(x.cpu.usage), x.cpu.temperature === null ? '' : `${Math.round(x.cpu.temperature)}°C`, x.cpu.usage, x.trend.cpu),
    stat('ram', pct(mem), x.memory ? ofTotal(x.memory.used, x.memory.total) : '', mem, x.trend.memory),
    stat('disk', pct(disk), x.storage ? ofTotal(x.storage.used, x.storage.total) : '', disk),
    stat('uptime', uptime(x.uptime), ''),
  );
  card.hidden = false;
}

export function startHost(main: HTMLElement, scope: Scope) {
  const card = $('[data-host]', main);
  if (!card) return;
  let timer = 0, alive = true;
  const tick = async () => {
    clearTimeout(timer);
    try {
      const res = await fetch('/api/homelab/host', { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
      const body = res.ok ? ((await res.json().catch(() => null)) as Host | null) : null;
      if (alive && body?.hardware) paint(card, body);
    } catch {
      // keep what's there; the next poll tries again
    }
    if (alive && document.visibilityState === 'visible') timer = window.setTimeout(tick, POLL);
  };
  scope.on(document, 'visibilitychange', () => (document.visibilityState === 'visible' ? tick() : clearTimeout(timer)));
  scope.add(() => ((alive = false), clearTimeout(timer)));
  tick();
}
