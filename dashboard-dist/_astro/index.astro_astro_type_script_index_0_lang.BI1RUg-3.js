import{a as i}from"./api.B63xdRaj.js";import{t as u,u as d,n as g,s as L,e as w,b as M}from"./format.BCwVRjzP.js";import{l as T,c as D,m as j}from"./charts.CtonQSNy.js";import"./installCanvasRenderer.4JmZ8sp0.js";const e=s=>document.querySelector(s),y=e("#window");let l,r,c;async function f(){const s=y.value,[o,v]=await Promise.all([i.overview(s),i.sessions("?limit=500")]);e(".hero-tokens").textContent=u(o.total_tokens),e("#hero-cost").textContent=d(o.total_cost_usd),e("#hero-sessions").textContent=g(o.session_count);const k=o.session_count?o.total_cost_usd/o.session_count:0;e("#hero-avg").textContent=o.session_count?`· ~${d(k)} est/session`:"";const C=s==="today"?Date.now()-864e5:s==="7d"?Date.now()-7*864e5:s==="30d"?Date.now()-30*864e5:0,m=v.sessions.filter(t=>new Date(t.started_at).getTime()>=C),h=Object.entries(o.cost_by_day).sort().map(([t,a])=>({day:t,cost:a}));l?.dispose(),h.length?l=T(e("#line"),h):e("#line").innerHTML='<p class="empty">No spend in this window.</p>';const b=s==="all"?o:await i.overview("all"),$=Object.entries(b.cost_by_day).sort().map(([t,a])=>({day:t,cost:a}));r?.dispose(),r=D(e("#heatmap"),$,90);const n=new Map;for(const t of m)n.set(t.primary_model,(n.get(t.primary_model)??0)+t.total_cost_usd);const _=[...n.entries()].sort((t,a)=>a[1]-t[1]).map(([t,a])=>({name:t,cost:a}));c?.dispose(),_.length?c=j(e("#models"),_):e("#models").innerHTML='<p class="empty">No data.</p>';const p=m.sort((t,a)=>a.total_cost_usd-t.total_cost_usd).slice(0,8);e("#recent").innerHTML=p.length?`
        <table>
          <thead><tr><th>Started</th><th>Project</th><th>Model</th><th class="num">Tokens</th><th class="num">Cost <span class="est">(est.)</span></th></tr></thead>
          <tbody>
            ${p.map(t=>`
              <tr data-id="${encodeURIComponent(t.id)}">
                <td>${L(t.started_at)}</td>
                <td class="mono">${w(M(t.project_path))}</td>
                <td><code>${w(t.primary_model)}</code></td>
                <td class="num tok">${u(t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens)}</td>
                <td class="num cost">~${d(t.total_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',e("#recent").querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}y.addEventListener("change",f);f();window.addEventListener("resize",()=>[l,r,c].forEach(s=>s?.resize()));
