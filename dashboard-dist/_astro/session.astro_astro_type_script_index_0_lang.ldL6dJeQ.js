import{a as _}from"./api.B63xdRaj.js";import{u as p,t as L,n as a,d as C}from"./format.DZCscyiN.js";const k=Intl.DateTimeFormat().resolvedOptions().timeZone,$=(()=>{const t=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return t?t[0]:""})(),m=e=>e?new Date(e).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",f=e=>e?new Date(e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function E(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function M(e){const t="\0MK_OPEN\0",n="\0MK_CLOSE\0",o=e.replace(/<mark>/g,t).replace(/<\/mark>/g,n);return E(o).replace(new RegExp(t,"g"),"<mark>").replace(new RegExp(n,"g"),"</mark>")}function D(e){switch(e){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return e}}const x=new URLSearchParams(location.search),u=x.get("id"),b=x.get("q")??"",h=document.getElementById("content");u?_.session(u).then(e=>{if(!e){h.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:n}=e,o=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,d=t.metadata?.sub_agent_session_ids,T=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${p(t.agent_reported_cost_usd)})</span>`:"";h.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${L(o)}</span><span class="kpi-sub">${a(o)} total</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${p(t.total_cost_usd)}</span><span class="kpi-sub">${T}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${a(t.turn_count)}</span><span class="kpi-sub">${n.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${C(t.duration_sec)}</span><span class="kpi-sub">started ${m(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${t.agent_version??"—"}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${t.project_path||"—"}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${t.primary_model}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${m(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${$} (${k})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?m(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${a(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${a(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${a(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${a(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${t.pricing_table_version}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${t.id}</td></tr>
              </tbody>
            </table>
          </div>

          ${d?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${d.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${d.map(s=>`<li><a href="/session?id=${encodeURIComponent(s)}" class="mono">${s}</a></li>`).join("")}
            </ul>
          </div>`:""}

          <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
              <h3 style="margin:0;flex-shrink:0;">Search this session</h3>
              <input id="seg-q" type="text" placeholder="Find text in this session…"
                style="flex:1;min-width:200px;background:var(--bg-2);color:var(--text-0);
                       border:1px solid var(--border);border-radius:6px;padding:0.4rem 0.7rem;
                       font-size:0.9rem;font-family:inherit;outline:none;" />
              <span id="seg-count" style="color:var(--text-2);font-size:0.8rem;"></span>
            </div>
            <div id="seg-results" style="margin-top:0.8rem;"></div>
          </div>

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <h3 style="margin:0;">Turns timeline</h3>
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${$} (${k})</span>
            </div>
            ${n.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost <span class="est">(est.)</span></th>
                </tr>
              </thead>
              <tbody>
                ${n.map(s=>`
                  <tr>
                    <td class="num">${s.sequence}</td>
                    <td>${f(s.timestamp)}</td>
                    <td><code>${s.model}</code></td>
                    <td class="num tok">${a(s.fresh_input_tokens)}</td>
                    <td class="num tok">${a(s.cache_read_tokens)}</td>
                    <td class="num tok">${a(s.cache_write_tokens)}</td>
                    <td class="num tok">${a(s.output_tokens)}</td>
                    <td class="num">${s.tool_calls_count}</td>
                    <td class="num cost">~${p(s.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const c=document.getElementById("seg-q"),i=document.getElementById("seg-results"),g=document.getElementById("seg-count");let v;async function y(){const s=c.value.trim();if(!s){i.innerHTML="",g.textContent="";return}try{const l=await _.sessionTranscriptSearch(u,s,200);if(g.textContent=`${l.total} match${l.total===1?"":"es"}`,l.segments.length===0){i.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const w=l.segments.slice().sort((r,S)=>Date.parse(r.timestamp)-Date.parse(S.timestamp));i.innerHTML=w.map(r=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${r.role}">${D(r.role)}</span>
                  <span style="margin-left:0.5rem;">${f(r.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${M(r.snippet)}</div>
              </div>
            `).join("")}catch{i.innerHTML='<p class="empty">Search failed.</p>'}}c.addEventListener("input",()=>{clearTimeout(v),v=setTimeout(y,150)}),b&&(c.value=b,y())}):h.innerHTML='<p class="empty">No session id.</p>';
