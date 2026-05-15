import{a as m}from"./api.BABVPoSJ.js";import{t as w,u as a,n as b,s as $,e as _,b as C}from"./format.BCwVRjzP.js";import{l as g,c as L,m as k}from"./charts.CtonQSNy.js";import"./agents.BHBYKnbB.js";import"./installCanvasRenderer.4JmZ8sp0.js";const e=n=>document.querySelector(n),u=e("#window");let i,d,r;async function c(){const n=u.value,s=await m.overview(n);e(".hero-tokens").textContent=w(s.total_tokens),e("#hero-cost").textContent=a(s.total_cost_usd),e("#hero-sessions").textContent=b(s.session_count);const y=s.session_count?s.total_cost_usd/s.session_count:0;e("#hero-avg").textContent=s.session_count?`· ~${a(y)} est/session`:"";const l=Object.entries(s.cost_by_day).sort().map(([t,o])=>({day:t,cost:o}));i?.dispose(),l.length?i=g(e("#line"),l):e("#line").innerHTML='<p class="empty">No spend in this window.</p>';const v=n==="all"?s:await m.overview("all"),f=Object.entries(v.cost_by_day).sort().map(([t,o])=>({day:t,cost:o}));d?.dispose(),d=L(e("#heatmap"),f,90);const p=Object.entries(s.cost_by_model??{}).sort((t,o)=>o[1]-t[1]).map(([t,o])=>({name:t,cost:o}));r?.dispose(),p.length?r=k(e("#models"),p):e("#models").innerHTML='<p class="empty">No data.</p>';const h=(s.top_sessions??[]).slice(0,8);e("#recent").innerHTML=h.length?`
        <table>
          <thead><tr><th>Started</th><th>Project</th><th>Model</th><th class="num">Tokens <span class="est">(in window)</span></th><th class="num">Cost <span class="est">(in window)</span></th></tr></thead>
          <tbody>
            ${h.map(t=>`
              <tr data-id="${encodeURIComponent(t.id)}">
                <td>${$(t.started_at)}${t.days_active>1?` <span style="color:var(--text-2);font-size:0.75rem;">+${t.days_active-1}d</span>`:""}</td>
                <td class="mono">${_(C(t.project_path))}</td>
                <td><code>${_(t.primary_model)}</code></td>
                <td class="num tok">${w(t.window_tokens)}</td>
                <td class="num cost">~${a(t.window_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',e("#recent").querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}u.addEventListener("change",c);window.addEventListener("argus:filter-changed",c);c();window.addEventListener("resize",()=>[i,d,r].forEach(n=>n?.resize()));
