import { api } from './api';
import { h } from './h';
type Idea = {id:string; handle:string; email:string; country:string; title:string; category:string; description:string; link:string; adopted:number; hidden:number; winner_emailed:number};
export function ideasAdmin(root: HTMLElement) {
 const list = root.querySelector('[data-admin-ideas-list]')!;
 const status = root.querySelector('[data-ideas-state]')!;
 async function load() {
 try {
 const rows = await api<Idea[]>('GET','/api/admin/ideas');
 list.replaceChildren(...rows.map(i => {
 const article = h('article',{class:'msg'}, h('h3',{},i.title), h('p',{},`${i.handle} · ${i.email} · ${i.country} · ${i.category}`),h('p',{class:'msg-body'},i.description),i.link ? h('a',{href:i.link,rel:'noopener noreferrer',target:'_blank'},i.link) : null);
 for (const flag of ['adopted','hidden'] as const) {
 const button = h('button',{type:'button',class:'a-btn'},flag === 'adopted' ? (i.adopted ? 'undo adopted' : 'adopt + email winner') : (i.hidden ? 'unhide' : 'hide'));
 button.addEventListener('click',async () => {
 button.disabled = true;
 try { const result = await api<{winnerEmailed:boolean}>('PATCH',`/api/admin/ideas/${i.id}`,{[flag]:!i[flag]}); await load(); status.textContent = flag === 'adopted' && !i.adopted && !result.winnerEmailed ? 'Adopted; winner email not sent. Check email settings and retry below.' : 'Saved.'; } catch(e) {status.textContent=(e as Error).message;} finally {button.disabled=false;}
 }); article.append(button);
 }
 if (i.adopted && !i.winner_emailed) { const retry=h('button',{type:'button',class:'a-btn'},'retry winner email'); retry.addEventListener('click',async () => {retry.disabled=true; try {const r=await api<{winnerEmailed:boolean}>('PATCH',`/api/admin/ideas/${i.id}`,{adopted:true}); await load(); status.textContent=r.winnerEmailed?'Winner email sent.':'Email not sent. Check email settings.';} catch(e){status.textContent=(e as Error).message;} finally {retry.disabled=false;} }); article.append(retry); }
 return article;
 }));
 } catch(e) {status.textContent=(e as Error).message;}
 }
 root.querySelector('[data-ideas-refresh]')?.addEventListener('click',load); void load();
}
