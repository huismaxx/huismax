import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index';

const ID = '3f2b7c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b';
const get = async (env: Record<string, string>, path = '/muse') => (await app.request(`https://huismax.com${path}`, {}, env as never)).text();

test('the Umami script is on public pages only when a website ID is set', async () => {
  assert.doesNotMatch(await get({}), /analytics\.huismax\.com/);
  const html = await get({ UMAMI_WEBSITE_ID: ID });
  assert.match(html, new RegExp(`<script defer="" src="https://analytics.huismax.com/stats.js" data-website-id="${ID}" data-domains="huismax.com">`));
  // anything that isn't a UUID is ignored rather than written into the page
  assert.doesNotMatch(await get({ UMAMI_WEBSITE_ID: '"><script>x</script>' }), /analytics\.huismax\.com/);
});

test('/admin never loads analytics', async () => {
  assert.doesNotMatch(await get({ UMAMI_WEBSITE_ID: ID }, '/admin'), /analytics\.huismax\.com/);
});

test('/muse download and link events', async () => {
  const html = await get({});
  for (const from of ['top', 'step', 'end']) assert.match(html, new RegExp(`data-track="muse-download" data-track-version="[^"]+" data-track-from="${from}"`));
  assert.match(html, /data-track="muse-source"/);
  assert.match(html, /data-track="muse-board" data-track-board="hosyond"/);
  assert.match(html, /data-track="muse-board" data-track-board="stick"/);
});

test('a Chatwoot API inbox: the homepage gets its own live chat_ section, the header links to it', async () => {
  const html = await get({ CHATWOOT_INBOX_ID: 'Inbox123456789' }, '/');
  assert.match(html, /<script type="application\/json" id="chat-config">\{"inbox":"Inbox123456789"\}<\/script>/);
  assert.match(html, /<section id="chat" class="home-block home-talk"/);
  assert.match(html, /id="talk-input"/);
  assert.match(html, /<a class="menu-btn chat-btn" href="\/#chat" data-chat-open/);
  // no inbox, or one that isn't an id: no chat_, and the header's chat is a plain link to /reply
  for (const env of [{}, { CHATWOOT_INBOX_ID: '"><script>' }]) {
    const page = await get(env, '/');
    assert.doesNotMatch(page, /data-talk|chat-config/);
    assert.match(page, /<a class="menu-btn chat-btn" href="\/reply">/);
  }
  // nothing of it on /admin
  assert.doesNotMatch(await get({ CHATWOOT_INBOX_ID: 'Inbox123456789' }, '/admin'), /chat-config|chat\.huismax/);
});
