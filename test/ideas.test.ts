import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import app from '../src/index';
import { validateIdea } from '../src/lib/ideas';
/** D1 over node:sqlite: just what the worker uses (prepare/bind/first/all/run, batch as one transaction). */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  type Stmt = ReturnType<typeof stmt>;
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => (db.prepare(sql).get(...(args as never[])) as object | undefined) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])), success: true }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } }),
    exec: () => db.prepare(sql).run(...(args as never[])),
  });
  return {
    db,
    prepare: (sql: string) => stmt(sql),
    batch: async (list: Stmt[]) => {
      db.exec('BEGIN');
      try {
        for (const s of list) s.exec();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return [];
    },
  };
}

/** KV without expiry: tests clear the "one a minute" keys themselves. */
function fakeKV() {
  const kv = new Map<string, string>();
  return {
    kv,
    get: async (k: string, t?: unknown) => (kv.has(k) ? ((t as { type?: string })?.type === 'json' || t === 'json' ? JSON.parse(kv.get(k)!) : kv.get(k)) : null),
    put: async (k: string, v: string) => void kv.set(k, v),
    delete: async (k: string) => void kv.delete(k),
  };
}


const D1 = fakeD1(), KV = fakeKV();
const mail: {to:string[]; text:string; headers:Headers}[] = [];
let failMail = false;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
 if (String(url).includes('api.resend.com')) {
  mail.push({...JSON.parse(String(init?.body)),headers:new Headers(init?.headers)});
  return new Response('{}',{status:failMail ? 503 : 200});
 }
 return new Response(JSON.stringify({icestats:{}}));
}) as typeof fetch;
const env = {DB:D1, STATE:KV, ADMIN_TOKEN:'test-admin',RESEND_API_KEY:'fake-key',REPLY_TO:'max@example.com'} as never;
const pending: Promise<unknown>[] = [];
const ctx = { waitUntil(p:Promise<unknown>){pending.push(p);},passThroughOnException(){},props:{} } as never;
const valid = {handle:'public-handle',email:'private@example.com',country:'private-country',category:'Feature idea',title:'Desk timer',description:'<script>alert(1)</script>',link:'https://example.com/demo',agree:'yes'};
const send = (data:unknown,ip='192.0.2.1',origin='https://huismax.com') => app.request('https://huismax.com/api/ideas',{method:'POST',headers:{'Content-Type':'application/json',origin,'CF-Connecting-IP':ip},body:JSON.stringify(data)},env,ctx);
const page = async () => (await app.request('https://huismax.com/ideas',{},env,ctx)).text();
const admin = (path:string, data?:unknown) => app.request('https://huismax.com/api/admin/ideas'+path,{method:data ? 'PATCH':'GET',headers:{authorization:'Bearer test-admin','Content-Type':'application/json'},body:data ? JSON.stringify(data):undefined},env,ctx);

test('ideas: immediately public, private fields excluded, escaped, emailed, newest first',async () => {
 assert.equal((await send(valid)).status,200);
 await Promise.all(pending);
 assert.equal(mail[0].to[0],'max@example.com');
 assert.match(mail[0].text,/Desk timer/);
 let html = await page();
 assert.match(html,/public-handle/);
 assert.match(html,/&lt;script&gt;alert/);
 assert.doesNotMatch(html,/private@example.com|private-country|<script>alert/);
 assert.equal((await send({...valid,title:'Newest idea'},'192.0.2.2')).status,200);
 D1.db.prepare("UPDATE ideas SET created_at = '2099-01-01' WHERE title = 'Newest idea'").run();
 html = await page();
 assert.ok(html.indexOf('<h3>Newest idea') < html.indexOf('<h3>Desk timer'));
});
test('ideas: validation, honeypot, origin, limits and admin authentication',async () => {
 for (const change of [{email:''},{handle:''},{country:''},{title:''},{description:'x'.repeat(5001)},{category:'invalid'},{agree:false},{link:'javascript:alert(1)'},{link:'https://user:pass@example.com'}]) {
 assert.throws(() => validateIdea({...valid,...change}));
 }
 assert.equal((await send(valid,'192.0.2.1','https://evil.example')).status,403);
 const before = D1.db.prepare('SELECT COUNT(*) AS n FROM ideas').get()!.n;
 assert.equal((await send({...valid,website:'bot'})).status,200);
 assert.equal(D1.db.prepare('SELECT COUNT(*) AS n FROM ideas').get()!.n,before);
 assert.equal((await send(valid)).status,429);
 assert.equal((await app.request('https://huismax.com/api/admin/ideas',{},env,ctx)).status,401);
 const ip='192.0.2.9';
 for (let n=0;n<10;n++) {
 for (const k of KV.kv.keys()) if(k.startsWith('ideas:recent:')) KV.kv.delete(k);
 assert.equal((await send({...valid,title:`rate test ${n}`},ip)).status,200);
 }
 for (const k of KV.kv.keys()) if(k.startsWith('ideas:recent:')) KV.kv.delete(k);
 assert.equal((await send(valid,ip)).status,429);
});
test('ideas: moderation updates badge, hides spam, sends winner mail with retry and no resend',async () => {
 const rows = await (await admin('')).json() as {id:string;title:string}[];
 const id = rows.find(i=>i.title==='Desk timer')!.id;
 failMail=true;
 let res = await admin('/'+id,{adopted:true});
 assert.equal((await res.json()).winnerEmailed,false);
 assert.match(await page(),/idea-badge">Adopted/);
 failMail=false;
 res = await admin('/'+id,{adopted:true});
 assert.equal((await res.json()).winnerEmailed,true);
 assert.equal(mail.at(-1)!.to[0],'private@example.com');
 assert.match(mail.at(-1)!.text,/US shipping address/);
 assert.ok(mail.at(-1)!.headers.get('Idempotency-Key'));
 const count=mail.length;
 await admin('/'+id,{hidden:true});
 assert.equal(mail.length,count);
 assert.doesNotMatch(await page(),/<h3>Desk timer/);
 await admin('/'+id,{adopted:false}); await admin('/'+id,{adopted:true});
 assert.equal(mail.length,count,'re-adopting does not send another prize email');
});
test('/start: static copy, src query retained, unreleased sections hidden, no chat scripts',async () => {
 const res = await app.request('https://huismax.com/start?src=nfc',{},env,ctx);
 assert.equal(res.status,200);
 const html = await res.text();
 assert.match(html,/<h1>Hello. Let&#39;s set up your companion/);
 assert.match(html,/<ul><li><strong>A Windows PC/);
 assert.match(html,/USB-C cable from the box/);
 assert.doesNotMatch(html,/Download your companion|start\/firmware|offline voice|chat-config|when available/);
 const home = await (await app.request('https://huismax.com/',{},env,ctx)).text();
 assert.doesNotMatch(home,/href="\/ideas"/);
});
