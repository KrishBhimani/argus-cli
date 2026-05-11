import{a as k,u as m,t as C,n as a,d as E,e as n}from"./format.CWX3gsCt.js";const $=Intl.DateTimeFormat().resolvedOptions().timeZone,f=(()=>{const t=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return t?t[0]:""})(),u=s=>s?new Date(s).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",b=s=>s?new Date(s).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function M(s){const t="\0MK_OPEN\0",r="\0MK_CLOSE\0",i=s.replace(/<mark>/g,t).replace(/<\/mark>/g,r);return n(i).replace(new RegExp(t,"g"),"<mark>").replace(new RegExp(r,"g"),"</mark>")}function D(s){switch(s){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return s}}const T=new URLSearchParams(location.search),h=T.get("id"),x=T.get("q")??"",g=document.getElementById("content");h?k.session(h).then(s=>{if(!s){g.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:r}=s,i=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,c=t.metadata?.sub_agent_session_ids,w=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${m(t.agent_reported_cost_usd)})</span>`:"";g.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${C(i)}</span><span class="kpi-sub">${a(i)} total</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${m(t.total_cost_usd)}</span><span class="kpi-sub">${w}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${a(t.turn_count)}</span><span class="kpi-sub">${r.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${E(t.duration_sec)}</span><span class="kpi-sub">started ${u(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${n(t.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${n(t.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${n(t.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${u(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${n(f)} (${n($)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?u(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${a(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${a(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${a(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${a(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${n(t.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${n(t.id)}</td></tr>
              </tbody>
            </table>
          </div>

          ${c?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${c.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${c.map(e=>`<li><a href="/session?id=${encodeURIComponent(e)}" class="mono">${n(e)}</a></li>`).join("")}
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${f} (${$})</span>
            </div>
            ${r.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost <span class="est">(est.)</span></th>
                </tr>
              </thead>
              <tbody>
                ${r.map(e=>`
                  <tr>
                    <td class="num">${e.sequence}</td>
                    <td>${b(e.timestamp)}</td>
                    <td><code>${n(e.model)}</code></td>
                    <td class="num tok">${a(e.fresh_input_tokens)}</td>
                    <td class="num tok">${a(e.cache_read_tokens)}</td>
                    <td class="num tok">${a(e.cache_write_tokens)}</td>
                    <td class="num tok">${a(e.output_tokens)}</td>
                    <td class="num">${e.tool_calls_count}</td>
                    <td class="num cost">~${m(e.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const p=document.getElementById("seg-q"),d=document.getElementById("seg-results"),v=document.getElementById("seg-count");let y;async function _(){const e=p.value.trim();if(!e){d.innerHTML="",v.textContent="";return}try{const l=await k.sessionTranscriptSearch(h,e,200);if(v.textContent=`${l.total} match${l.total===1?"":"es"}`,l.segments.length===0){d.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const S=l.segments.slice().sort((o,L)=>Date.parse(o.timestamp)-Date.parse(L.timestamp));d.innerHTML=S.map(o=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${o.role}">${D(o.role)}</span>
                  <span style="margin-left:0.5rem;">${b(o.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${M(o.snippet)}</div>
              </div>
            `).join("")}catch{d.innerHTML='<p class="empty">Search failed.</p>'}}p.addEventListener("input",()=>{clearTimeout(y),y=setTimeout(_,150)}),x&&(p.value=x,_())}):g.innerHTML='<p class="empty">No session id.</p>';
