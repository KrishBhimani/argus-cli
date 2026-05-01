import{a as i}from"./api.DTjsyKW_.js";import{u as d,t as l,n as w,a as g,s as j,b as L}from"./format.BUtUhAI5.js";import{l as M,a as x,c as D,m as E}from"./charts.Br1hTK5R.js";const e=n=>document.querySelector(n),f=e("#window");let r,c,p,m;async function v(){const n=f.value,[s,$]=await Promise.all([i.overview(n),i.sessions("?limit=500")]);e(".hero-cost").textContent=d(s.total_cost_usd),e("#hero-tokens").textContent=l(s.total_tokens),e("#hero-sessions").textContent=w(s.session_count);const b=s.session_count?s.total_cost_usd/s.session_count:0;e("#hero-avg").textContent=s.session_count?`· ${d(b)} avg/session`:"";const C=n==="today"?Date.now()-864e5:n==="7d"?Date.now()-7*864e5:n==="30d"?Date.now()-30*864e5:0,h=$.sessions.filter(t=>new Date(t.started_at).getTime()>=C),_=Object.entries(s.cost_by_day).sort().map(([t,o])=>({day:t,cost:o}));r?.dispose(),_.length?r=M(e("#line"),_):e("#line").innerHTML='<p class="empty">No spend in this window.</p>',c?.dispose(),c=x(e("#agents"),s.agent_split),e("#agents-stats").innerHTML=Object.entries(s.agent_split).map(([t,o])=>`<div style="display:flex;justify-content:space-between;padding:0.2rem 0;">
          ${g(t)}<span>${w(o.sessions)} sessions · ${l(o.tokens)} tokens</span>
        </div>`).join("")||'<div class="empty" style="padding:0.5rem;">—</div>',s.cost_by_day;const k=n==="all"?s:await i.overview("all"),T=Object.entries(k.cost_by_day).sort().map(([t,o])=>({day:t,cost:o}));p?.dispose(),p=D(e("#heatmap"),T,90);const a=new Map;for(const t of h)a.set(t.primary_model,(a.get(t.primary_model)??0)+t.total_cost_usd);const u=[...a.entries()].sort((t,o)=>o[1]-t[1]).map(([t,o])=>({name:t,cost:o}));m?.dispose(),u.length?m=E(e("#models"),u):e("#models").innerHTML='<p class="empty">No data.</p>';const y=h.sort((t,o)=>o.total_cost_usd-t.total_cost_usd).slice(0,5);e("#recent").innerHTML=y.length?`
        <table>
          <thead><tr><th>Started</th><th>Agent</th><th>Project</th><th>Model</th><th class="num">Tokens</th><th class="num">Cost</th></tr></thead>
          <tbody>
            ${y.map(t=>`
              <tr data-id="${encodeURIComponent(t.id)}">
                <td>${j(t.started_at)}</td>
                <td>${g(t.agent)}</td>
                <td class="mono">${L(t.project_path)}</td>
                <td>${t.primary_model}</td>
                <td class="num">${l(t.total_fresh_input_tokens+t.total_output_tokens)}</td>
                <td class="num cost">${d(t.total_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',e("#recent").querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}f.addEventListener("change",v);v();window.addEventListener("resize",()=>[r,c,p,m].forEach(n=>n?.resize()));
