import type { Env } from './env';
import { EMAIL, InputError, newId, type Settings } from './cms';
import { destination, sender, emailReady } from './reply';
export const CATEGORIES = ['Feature idea', 'ESP32 use case', 'Bug or rough edge', 'Other'] as const;
export type Idea = { id: string; handle: string; email: string; country: string; category: string; title: string; description: string; link: string; adopted: number; hidden: number; emailed: number; winner_emailed: number; created_at: string };
export type PublicIdea = Pick<Idea, 'id' | 'handle' | 'category' | 'title' | 'description' | 'link' | 'adopted' | 'created_at'>;
export function validateIdea(b: Record<string, unknown>) {
 const field = (key: string, max: number, required = true) => {
  const v = typeof b[key] === 'string' ? b[key].trim() : '';
  if ((required && !v) || v.length > max) throw new InputError(`${key}: ${required ? 'required, ' : ''}${max} characters max`);
  return v;
 };
 const handle = field('handle',60), email = field('email',200), country = field('country',80), category = field('category',40), title = field('title',160), description = field('description',5000), link = field('link',1000,false);
 if (!EMAIL.test(email)) throw new InputError('Enter a valid email.');
 if (!(CATEGORIES as readonly string[]).includes(category)) throw new InputError('Choose a category.');
 if (b.agree !== 'yes') throw new InputError('Please agree to the rules.');
 if (link) { try { const u = new URL(link); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw Error(); } catch { throw new InputError('Link must be an http or https URL.'); } }
 return { handle, email, country, category, title, description, link };
}
export async function listIdeas(env: Env, admin = false) {
 if (!env.DB) return [];
 const columns = admin ? '*' : 'id, handle, category, title, description, link, adopted, created_at';
 return (await env.DB.prepare(`SELECT ${columns} FROM ideas ${admin ? '' : 'WHERE hidden = 0'} ORDER BY created_at DESC, id DESC`).all<Idea>()).results;
}
export async function saveIdea(env: Env, b: ReturnType<typeof validateIdea>) {
 const i: Idea = { id: newId(), ...b, adopted:0, hidden:0, emailed:0, winner_emailed:0, created_at:new Date().toISOString() };
 await env.DB!.prepare('INSERT INTO ideas (id, handle, email, country, category, title, description, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(i.id,i.handle,i.email,i.country,i.category,i.title,i.description,i.link,i.created_at).run();
 return i;
}
export async function emailIdea(env: Env, s: Settings, i: Idea, winner = false): Promise<boolean> {
 if (!emailReady(env,s)) return false;
 try {
 const sent = await env.DB!.prepare('SELECT COUNT(*) AS n FROM ideas WHERE (emailed = 1 OR winner_emailed = 1) AND created_at > ?').bind(new Date(Date.now()-86400000).toISOString()).first<{n:number}>();
 if (!winner && (sent?.n ?? 0) >= 40) return false;
 const res = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':`idea-${winner ? 'winner' : 'new'}-${i.id}`}, body:JSON.stringify({from:sender(env,s), to:[winner ? i.email : destination(env,s)], reply_to:winner ? destination(env,s) : i.email, subject:winner ? 'Your idea was adopted — your free companion' : `huismax — idea: ${i.title}`, text:winner ? `Hi ${i.handle},

We adopted your idea: ${i.title}. You get one free companion. Reply with your US shipping address to claim it.

Thank you,
huismax` : `${i.title}
${i.category}

${i.description}
${i.link}

${i.handle} <${i.email}>
Country: ${i.country}`}) });
 if (!res.ok) return false;
 await env.DB!.prepare(`UPDATE ideas SET ${winner ? 'winner_emailed' : 'emailed'} = 1 WHERE id = ?`).bind(i.id).run();
 return true;
 } catch { return false; }
}
