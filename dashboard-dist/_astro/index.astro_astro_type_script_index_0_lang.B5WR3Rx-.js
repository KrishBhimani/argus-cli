import{a as h,t as m,u as a,n as b,s as f,e as _,c as C}from"./format.CWX3gsCt.js";import{l as k,c as L,m as g}from"./charts.CtonQSNy.js";import"./installCanvasRenderer.4JmZ8sp0.js";const s=n=>document.querySelector(n),w=s("#window");let i,d,c;async function u(){const n=w.value,e=await h.overview(n);s(".hero-tokens").textContent=m(e.total_tokens),s("#hero-cost").textContent=a(e.total_cost_usd),s("#hero-sessions").textContent=b(e.session_count);const y=e.session_count?e.total_cost_usd/e.session_count:0;s("#hero-avg").textContent=e.session_count?`· ~${a(y)} est/session`:"";const r=Object.entries(e.cost_by_day).sort().map(([t,o])=>({day:t,cost:o}));i?.dispose(),r.length?i=k(s("#line"),r):s("#line").innerHTML='<p class="empty">No spend in this window.</p>';const v=n==="all"?e:await h.overview("all"),$=Object.entries(v.cost_by_day).sort().map(([t,o])=>({day:t,cost:o}));d?.dispose(),d=L(s("#heatmap"),$,90);const l=Object.entries(e.cost_by_model??{}).sort((t,o)=>o[1]-t[1]).map(([t,o])=>({name:t,cost:o}));c?.dispose(),l.length?c=g(s("#models"),l):s("#models").innerHTML='<p class="empty">No data.</p>';const p=(e.top_sessions??[]).slice(0,8);s("#recent").innerHTML=p.length?`
        <table>
          <thead><tr><th>Started</th><th>Project</th><th>Model</th><th class="num">Tokens <span class="est">(in window)</span></th><th class="num">Cost <span class="est">(in window)</span></th></tr></thead>
          <tbody>
            ${p.map(t=>`
              <tr data-id="${encodeURIComponent(t.id)}">
                <td>${f(t.started_at)}${t.days_active>1?` <span style="color:var(--text-2);font-size:0.75rem;">+${t.days_active-1}d</span>`:""}</td>
                <td class="mono">${_(C(t.project_path))}</td>
                <td><code>${_(t.primary_model)}</code></td>
                <td class="num tok">${m(t.window_tokens)}</td>
                <td class="num cost">~${a(t.window_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',s("#recent").querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}w.addEventListener("change",u);u();window.addEventListener("resize",()=>[i,d,c].forEach(n=>n?.resize()));
