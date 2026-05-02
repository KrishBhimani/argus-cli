import{a as i}from"./api.D62A6-WM.js";import{t as u,u as d,n as b,s as g,a as L}from"./format.cWKWqGW_.js";import{l as M,c as T,m as D}from"./charts.CZlg7ra9.js";import"./installCanvasRenderer.74_xnF0m.js";const e=s=>document.querySelector(s),w=e("#window");let l,r,c;async function y(){const s=w.value,[o,f]=await Promise.all([i.overview(s),i.sessions("?limit=500")]);e(".hero-tokens").textContent=u(o.total_tokens),e("#hero-cost").textContent=d(o.total_cost_usd),e("#hero-sessions").textContent=b(o.session_count);const v=o.session_count?o.total_cost_usd/o.session_count:0;e("#hero-avg").textContent=o.session_count?`· ~${d(v)} est/session`:"";const k=s==="today"?Date.now()-864e5:s==="7d"?Date.now()-7*864e5:s==="30d"?Date.now()-30*864e5:0,m=f.sessions.filter(t=>new Date(t.started_at).getTime()>=k),h=Object.entries(o.cost_by_day).sort().map(([t,a])=>({day:t,cost:a}));l?.dispose(),h.length?l=M(e("#line"),h):e("#line").innerHTML='<p class="empty">No spend in this window.</p>';const C=s==="all"?o:await i.overview("all"),$=Object.entries(C.cost_by_day).sort().map(([t,a])=>({day:t,cost:a}));r?.dispose(),r=T(e("#heatmap"),$,90);const n=new Map;for(const t of m)n.set(t.primary_model,(n.get(t.primary_model)??0)+t.total_cost_usd);const _=[...n.entries()].sort((t,a)=>a[1]-t[1]).map(([t,a])=>({name:t,cost:a}));c?.dispose(),_.length?c=D(e("#models"),_):e("#models").innerHTML='<p class="empty">No data.</p>';const p=m.sort((t,a)=>a.total_cost_usd-t.total_cost_usd).slice(0,8);e("#recent").innerHTML=p.length?`
        <table>
          <thead><tr><th>Started</th><th>Project</th><th>Model</th><th class="num">Tokens</th><th class="num">Cost <span class="est">(est.)</span></th></tr></thead>
          <tbody>
            ${p.map(t=>`
              <tr data-id="${encodeURIComponent(t.id)}">
                <td>${g(t.started_at)}</td>
                <td class="mono">${L(t.project_path)}</td>
                <td><code>${t.primary_model}</code></td>
                <td class="num tok">${u(t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens)}</td>
                <td class="num cost">~${d(t.total_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',e("#recent").querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}w.addEventListener("change",y);y();window.addEventListener("resize",()=>[l,r,c].forEach(s=>s?.resize()));
