import { h } from '../admin/h';
import { $, $$ } from './dom';
import { track } from './track';

/**
 * Chat with Max, in the site's own design: the homepage's chat_ section, live both ways. Chatwoot
 * (chat.huismax.com) is only the backend: its public client API for an API-channel inbox (CHATWOOT_INBOX_ID)
 * and its websocket (/cable), so Max's replies and "typing…" show up the moment he sends them from Chatwoot.
 *
 * The visitor's contact and conversation are created on their first message and kept in this browser
 * (localStorage), so coming back shows the conversation again. The socket stays open while browsing other pages;
 * a reply that arrives there lights a dot on the header's chat button. If the socket can't connect, it polls.
 */

const BASE = 'https://chat.huismax.com';
const KEY = 'huismax:talk';
const MAX_LEN = 1000;
/** how often to ask for messages: without the socket, and (as a safety net for a missed event) with it */
const POLL = 10_000;
const POLL_LIVE = 60_000;
/** a subscription Chatwoot hasn't confirmed by then is treated as failed */
const CONFIRM_TIMEOUT = 10_000;
const PRESENCE = 20_000;

type Saved = { inbox: string; sourceId: string; pubsub: string; contactId: number; conversationId: number };
export type Msg = { id: number | string; text: string; mine: boolean; at: number; pending?: boolean; failed?: boolean };

const read = (inbox: string): Saved | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return v && v.inbox === inbox && v.sourceId && v.conversationId ? v : null;
  } catch {
    return null;
  }
};
const write = (v: Saved | null) => {
  try {
    v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY);
  } catch {
    /* private mode: the conversation lasts this visit */
  }
};

/** Chatwoot's message, as the chat shows it; null for activity notes, private notes and empty ones. */
function toMsg(m: Record<string, unknown>): Msg | null {
  const type = typeof m.message_type === 'number' ? m.message_type : ({ incoming: 0, outgoing: 1, activity: 2, template: 3 } as Record<string, number>)[String(m.message_type)];
  if (m.private || (type !== 0 && type !== 1)) return null;
  const text = typeof m.content === 'string' ? m.content.trim() : '';
  if (!text) return null;
  const at = typeof m.created_at === 'number' ? m.created_at * 1000 : Date.parse(String(m.created_at)) || Date.now();
  return { id: Number(m.id), text, mine: type === 0, at };
}

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (t: number) => new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();

export function startTalk(inbox: string, navigate: (href: string) => void) {
  let saved = read(inbox);
  let msgs: Msg[] = [];
  let typing = false;
  let typingTimer = 0;
  let loaded = false;
  let busy = false;
  let error = '';
  let ws: WebSocket | null = null;
  let wsUp = false;
  let pollTimer = 0;
  let presenceTimer = 0;
  let retry = 0;
  let unread = false;
  let view: HTMLElement | null = null;
  /** messages already on screen: only new ones animate in */
  const shown = new Set<string>();

  const api = (path: string, init?: RequestInit) =>
    fetch(`${BASE}/public/api/v1/inboxes/${encodeURIComponent(inbox)}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    }).then(async (r) => {
      if (!r.ok) throw Object.assign(new Error(`chat ${r.status}`), { status: r.status });
      return r.json();
    });
  const convo = () => `/contacts/${encodeURIComponent(saved!.sourceId)}/conversations/${saved!.conversationId}`;

  /* ——— the messages ——— */

  const add = (m: Msg) => {
    const i = msgs.findIndex((x) => x.id === m.id);
    if (i >= 0) msgs[i] = m;
    else msgs.push(m);
    msgs.sort((a, b) => a.at - b.at);
  };
  const onMessage = (raw: Record<string, unknown>) => {
    const m = toMsg(raw);
    if (!m) return;
    // our own message coming back over the socket: replace the pending copy
    const echo = typeof raw.echo_id === 'string' ? msgs.findIndex((x) => x.id === raw.echo_id) : -1;
    if (echo >= 0) msgs.splice(echo, 1);
    add(m);
    if (!m.mine) {
      typing = false;
      if (!view?.isConnected || document.hidden) unread = true;
    }
    paint();
  };

  async function load() {
    if (!saved) return void ((loaded = true), paint());
    try {
      const list = (await api(`${convo()}/messages`)) as Record<string, unknown>[];
      for (const raw of Array.isArray(list) ? list : []) {
        const m = toMsg(raw);
        if (m) add(m);
      }
      error = '';
    } catch (e) {
      // the contact or conversation was deleted in Chatwoot: start over on the next message
      if ((e as { status?: number }).status === 404) {
        saved = null;
        write(null);
        msgs = [];
      }
    }
    loaded = true;
    paint();
  }

  /* ——— live: Chatwoot's ActionCable socket, polling when it can't connect ——— */

  // A visitor subscribes with its pubsub token alone. `user_id` means an agent to Chatwoot's RoomChannel: with the
  // contact's id there it looks for a user, finds none, and the subscription silently never happens.
  const identifier = () => JSON.stringify({ channel: 'RoomChannel', pubsub_token: saved!.pubsub });
  function connect() {
    if (!saved || ws) return;
    const sock = new WebSocket(`${BASE.replace(/^http/, 'ws')}/cable`);
    ws = sock;
    // not confirmed (or rejected): close, poll, and try again later, rather than wait on a socket that says nothing
    const confirmTimer = window.setTimeout(() => sock.close(), CONFIRM_TIMEOUT);
    sock.onopen = () => sock.send(JSON.stringify({ command: 'subscribe', identifier: identifier() }));
    sock.onmessage = (e) => {
      let d: { type?: string; message?: { event?: string; data?: Record<string, unknown> } };
      try {
        d = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (d.type === 'confirm_subscription') {
        clearTimeout(confirmTimer);
        wsUp = true;
        retry = 0;
        presence();
        // anything sent while we weren't listening
        void load();
        schedulePoll();
        paint();
        return;
      }
      if (d.type === 'reject_subscription') return void sock.close();
      const ev = d.message?.event, data = d.message?.data;
      if (!ev || !data) return;
      if (ev === 'message.created' || ev === 'message.updated') onMessage(data);
      else if (ev === 'conversation.typing_on' || ev === 'conversation.typing_off') {
        const who = (data.user as { type?: string } | undefined)?.type;
        if (who === 'contact') return;
        typing = ev === 'conversation.typing_on';
        clearTimeout(typingTimer);
        // a "typing" that never got its "stopped": let it go after a while
        if (typing) typingTimer = window.setTimeout(() => ((typing = false), paint()), 30_000);
        paint();
      }
    };
    sock.onclose = () => {
      clearTimeout(confirmTimer);
      if (ws === sock) ws = null;
      wsUp = false;
      clearTimeout(presenceTimer);
      paint();
      // try again later; meanwhile poll() asks every few seconds
      retry = Math.min(retry + 1, 6);
      schedulePoll();
      window.setTimeout(connect, 1000 * 2 ** retry);
    };
  }
  /** Asks for the messages every 10 s without the socket, every minute with it (in case an event went missing). */
  const schedulePoll = () => {
    clearTimeout(pollTimer);
    if (saved) pollTimer = window.setTimeout(poll, wsUp ? POLL_LIVE : POLL);
  };
  async function poll() {
    if (!document.hidden) await load();
    schedulePoll();
  }
  /** Lets Max see in Chatwoot that the visitor is still here. */
  function presence() {
    clearTimeout(presenceTimer);
    if (!wsUp || !ws) return;
    ws.send(JSON.stringify({ command: 'message', identifier: identifier(), data: JSON.stringify({ action: 'update_presence' }) }));
    presenceTimer = window.setTimeout(presence, PRESENCE);
  }

  /* ——— sending ——— */

  async function ensureConversation() {
    if (saved) return;
    const c = (await api('/contacts', { method: 'POST', body: '{}' })) as { source_id: string; pubsub_token: string; id: number };
    const conv = (await api(`/contacts/${encodeURIComponent(c.source_id)}/conversations`, { method: 'POST', body: '{}' })) as { id: number };
    saved = { inbox, sourceId: c.source_id, pubsub: c.pubsub_token, contactId: c.id, conversationId: conv.id };
    write(saved);
    connect();
    schedulePoll();
  }

  async function send(text: string, retryOf?: Msg) {
    text = text.trim().slice(0, MAX_LEN);
    if (!text || busy) return false;
    const echo = retryOf ? String(retryOf.id) : `echo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    add({ id: echo, text, mine: true, at: retryOf?.at ?? Date.now(), pending: true });
    error = '';
    busy = true;
    paint(true);
    try {
      const first = !saved;
      await ensureConversation();
      const m = (await api(`${convo()}/messages`, { method: 'POST', body: JSON.stringify({ content: text, echo_id: echo }) })) as Record<string, unknown>;
      onMessage({ ...m, echo_id: echo });
      // a visitor starting a conversation (the messages themselves are counted in Chatwoot)
      if (first) track('chat-start');
    } catch {
      const i = msgs.findIndex((x) => x.id === echo);
      if (i >= 0) msgs[i] = { ...msgs[i], pending: false, failed: true };
      error = 'not sent. check your connection and tap the message to try again.';
    }
    busy = false;
    paint(true);
    return true;
  }

  let typingSent = 0;
  const sendTyping = (on: boolean) => {
    if (!saved || (on && Date.now() - typingSent < 4000)) return;
    typingSent = on ? Date.now() : 0;
    api(`${convo()}/toggle_typing`, { method: 'POST', body: JSON.stringify({ typing_status: on ? 'on' : 'off' }) }).catch(() => {});
  };

  /* ——— drawing it into the homepage section ——— */

  function bubble(m: Msg, prev?: Msg) {
    const out: HTMLElement[] = [];
    if (!prev || day(prev.at) !== day(m.at)) out.push(h('li', { class: 'talk-day mono' }, day(m.at)));
    const li = h(
      'li',
      { class: shown.has(String(m.id)) ? 'talk-msg' : 'talk-msg is-new', 'data-mine': String(m.mine), 'data-state': m.failed ? 'failed' : m.pending ? 'pending' : 'sent' },
      h('span', { class: 'talk-bubble' }, m.text),
      h('span', { class: 'talk-meta mono' }, m.failed ? 'not sent · tap to retry' : m.pending ? 'sending…' : `${m.mine ? 'you' : 'max'} · ${clock(m.at)}`),
    );
    if (m.failed) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      const again = () => void send(m.text, m);
      li.addEventListener('click', again);
      li.addEventListener('keydown', (e) => e.key === 'Enter' && again());
    }
    out.push(li);
    return out;
  }

  function paint(scroll = false) {
    syncButtons();
    if (!view?.isConnected) return;
    const log = $('[data-talk-log]', view)!;
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    $('[data-talk-empty]', view)!.hidden = !loaded || msgs.length > 0;
    log.replaceChildren(...msgs.flatMap((m, i) => bubble(m, msgs[i - 1])));
    for (const m of msgs) shown.add(String(m.id));
    $('[data-talk-typing]', view)!.hidden = !typing;
    const err = $('[data-talk-error]', view)!;
    err.hidden = !error;
    err.textContent = error;
    $('[data-talk-status]', view)!.textContent = typing ? 'max is typing…' : saved && wsUp ? 'connected · live' : 'live';
    if (scroll || nearEnd) log.scrollTop = log.scrollHeight;
    if (!document.hidden) unread = false;
    syncButtons();
  }

  const syncButtons = () => {
    for (const b of $$('[data-chat-open]')) b.toggleAttribute('data-unread', unread);
  };

  /** The homepage's section (if this page has one): wire the form and draw. */
  function mount(main: HTMLElement) {
    view = $('[data-talk]', main);
    if (!view) return;
    shown.clear();
    const form = $<HTMLFormElement>('[data-talk-form]', view)!;
    const input = $<HTMLTextAreaElement>('textarea', form)!;
    const grow = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value;
      if (await send(text)) {
        input.value = '';
        grow();
        sendTyping(false);
      }
      input.focus();
    });
    input.addEventListener('keydown', (e) => {
      // Enter sends, Shift+Enter is a new line; never while an IME is composing (Chinese, Japanese…)
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener('input', () => {
      grow();
      sendTyping(!!input.value.trim());
    });
    unread = false;
    paint(true);
  }

  // the header's chat button (and any other) goes to the conversation
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest?.<HTMLElement>('[data-chat-open]');
    if (!b) return;
    e.preventDefault();
    const go = () => {
      const sec = document.getElementById('chat');
      sec?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $<HTMLTextAreaElement>('[data-talk] textarea')?.focus({ preventScroll: true });
    };
    if (document.getElementById('chat')) go();
    else {
      navigate('/#chat');
      setTimeout(go, 400);
    }
  });
  // back to the tab (phones suspend sockets in the background): catch up at once
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (saved) void load();
    else if (view?.isConnected) paint();
  });

  void load();
  connect();
  schedulePoll();
  return { sync: mount };
}
