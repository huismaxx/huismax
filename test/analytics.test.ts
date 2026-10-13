import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index';

const ID = '3f2b7c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b';
const get = async (env: Record<string, string>, path = '/muse') => (await app.request(`https://huismax.com${path}`, {}, env as never)).text();

test('the Umami script is on public pages only when a website ID is set', async () => {
  assert.doesNotMatch(await get({}), /analytics\.huismax\.com/);
  const html = await get({ UMAMI_WEBSITE_ID: ID });
  assert.match(html, new RegExp(`<script defer="" src="https://analytics.huismax.com/script.js" data-website-id="${ID}" data-domains="huismax.com">`));
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
