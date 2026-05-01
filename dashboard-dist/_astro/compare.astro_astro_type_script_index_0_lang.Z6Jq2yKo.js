import{a as y}from"./api.DTjsyKW_.js";import{n as v,u as r,t as c}from"./format.BUtUhAI5.js";const u=o=>document.querySelector(o),l=u("#w");function d(o,n,m,a){const e=Math.max(o,n,1e-4);return`<tr>
        <td style="width:30%;color:var(--text-2);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;">${m}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;width:30%;">${a(o)}</td>
        <td style="width:40%;padding:0;">
          <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--bg-2);">
            <div style="background:var(--claude);width:${o/e*50}%;"></div>
            <div style="width:0.5px;background:var(--border);"></div>
            <div style="background:var(--codex);width:${n/e*50}%;"></div>
          </div>
        </td>
        <td style="text-align:left;font-variant-numeric:tabular-nums;width:20%;padding-left:0.6rem;">${a(n)}</td>
      </tr>`}async function h(){const o=await y.overview(l.value),n=(await y.sessions("?limit=100000")).sessions,m=l.value==="7d"?Date.now()-7*864e5:l.value==="30d"?Date.now()-30*864e5:0,a=n.filter(t=>new Date(t.started_at).getTime()>=m),e=o.agent_split.claude_code??{cost:0,sessions:0,tokens:0},s=o.agent_split.codex??{cost:0,sessions:0,tokens:0},x=e.sessions?e.cost/e.sessions:0,f=s.sessions?s.cost/s.sessions:0,b=e.cost>0?e.tokens/e.cost:0,k=s.cost>0?s.tokens/s.cost:0,$=a.filter(t=>t.agent==="claude_code"),w=a.filter(t=>t.agent==="codex"),p=[...new Set($.map(t=>t.primary_model))],g=[...new Set(w.map(t=>t.primary_model))];u("#cards").innerHTML=`
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.6rem;">
            <h3 style="margin:0;color:var(--claude);font-size:1rem;">CLAUDE CODE</h3>
            <span style="color:var(--text-2);font-size:0.75rem;">${v(e.sessions)} sessions</span>
          </div>
          <div class="kpi-value cost" style="font-size:2.4rem;">${r(e.cost)}</div>
          <div style="color:var(--text-1);font-size:0.85rem;margin-top:0.2rem;">${c(e.tokens)} tokens</div>
          <div style="margin-top:1rem;font-size:0.85rem;color:var(--text-2);">
            Models used: ${p.length?p.map(t=>`<code>${t}</code>`).join(" "):"—"}
          </div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.6rem;">
            <h3 style="margin:0;color:var(--codex);font-size:1rem;">CODEX</h3>
            <span style="color:var(--text-2);font-size:0.75rem;">${v(s.sessions)} sessions</span>
          </div>
          <div class="kpi-value cost" style="font-size:2.4rem;color:var(--codex);">${r(s.cost)}</div>
          <div style="color:var(--text-1);font-size:0.85rem;margin-top:0.2rem;">${c(s.tokens)} tokens</div>
          <div style="margin-top:1rem;font-size:0.85rem;color:var(--text-2);">
            Models used: ${g.length?g.map(t=>`<code>${t}</code>`).join(" "):"—"}
          </div>
        </div>
      `;const i=document.createElement("div");i.className="card",i.style.gridColumn="1 / -1",i.style.marginTop="0",i.innerHTML=`
        <h3 style="margin-bottom:0.8rem;">Side-by-side</h3>
        <table style="border:none;">
          <thead><tr>
            <th></th>
            <th style="text-align:right;color:var(--claude);">Claude</th>
            <th></th>
            <th style="text-align:left;color:var(--codex);padding-left:0.6rem;">Codex</th>
          </tr></thead>
          <tbody>
            ${d(e.cost,s.cost,"Total cost",r)}
            ${d(e.sessions,s.sessions,"Sessions",v)}
            ${d(e.tokens,s.tokens,"Tokens",c)}
            ${d(x,f,"Avg cost / session",r)}
            ${d(b,k,"Tokens per $1",t=>c(Math.round(t)))}
          </tbody>
        </table>
      `,u("#cards").appendChild(i)}l.addEventListener("change",h);h();
