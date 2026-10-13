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

test('the chat buttons get Chatwoot only with a valid website token', async () => {
  assert.doesNotMatch(await get({}, '/'), /id="chat-config"/);
  const html = await get({ CHATWOOT_WEBSITE_TOKEN: 'AbC123xyz456DEF789' }, '/');
  assert.match(html, /<script type="application\/json" id="chat-config">\{"chatwoot":"AbC123xyz456DEF789"\}<\/script>/);
  assert.doesNotMatch(html, /data-talk/, 'a website token alone: the widget, no chat_ section');
  assert.doesNotMatch(await get({ CHATWOOT_WEBSITE_TOKEN: 'x"><b>' }, '/'), /id="chat-config"/);
  assert.doesNotMatch(await get({ CHATWOOT_WEBSITE_TOKEN: 'AbC123xyz456DEF789' }, '/admin'), /chat-config|chat\.huismax/);
});

test('a Chatwoot API inbox: the homepage gets its own live chat_ section', async () => {
  const html = await get({ CHATWOOT_WEBSITE_TOKEN: 'AbC123xyz456DEF789', CHATWOOT_INBOX_ID: 'Inbox123456789' }, '/');
  assert.match(html, /\{"chatwoot":"AbC123xyz456DEF789","inbox":"Inbox123456789"\}/);
  assert.match(html, /<section id="chat" class="home-block home-talk"/);
  assert.match(html, /id="talk-input"/);
  // an inbox id that isn't one is ignored
  assert.doesNotMatch(await get({ CHATWOOT_INBOX_ID: '"><script>' }, '/'), /data-talk|"inbox"/);
});
