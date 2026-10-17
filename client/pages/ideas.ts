import type { PageInit } from '../main';
import { track } from '../lib/track';
export const initIdeas: PageInit = (main,scope) => {
 const form = main.querySelector<HTMLFormElement>('[data-ideas-form]'); if (!form) return;
 const status = main.querySelector<HTMLElement>('[data-ideas-status]')!;
 let busy = false;
 scope.on(form,'submit',async (e: SubmitEvent) => {
 e.preventDefault(); if (busy || !form.reportValidity()) return;
 const data = Object.fromEntries(new FormData(form)); busy = true;
 const button = form.querySelector<HTMLButtonElement>('button')!; button.disabled = true;
 status.textContent = 'Sending…';
 try {
 const res = await fetch('/api/ideas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const out = await res.json() as {ok?:boolean; dropped?:boolean; error?:string};
 if (!res.ok || !out.ok) throw Error(out.error || 'Could not send. Please try again.');
 if (out.dropped) { status.textContent = 'Could not send. Please try again.'; return; }
 track('idea-sent'); form.reset();
 status.textContent = "Thanks — your idea is now on this page. If we adopt it, we'll email you.";
 try { const doc = new DOMParser().parseFromString(await (await fetch('/ideas',{cache:'no-store'})).text(),'text/html'); const list = doc.querySelector('[data-ideas-list]'); if (list) main.querySelector('[data-ideas-list]')?.replaceChildren(...Array.from(list.childNodes)); } catch { /* Submission remains successful when the list refresh fails. */ }
 } catch(e) { status.textContent = (e as Error).message; }
 finally { busy = false; button.disabled = false; }
 });
};
