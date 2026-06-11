import{a as $,u as y,t as C,n as r,d as O,e as s}from"./format.QZ7NjBLP.js";import{t as P}from"./charts.BhLqj-ev.js";const I=Intl.DateTimeFormat().resolvedOptions().timeZone,M=(()=>{const d=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return d?d[0]:""})(),k=a=>a?new Date(a).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",b=a=>a?new Date(a).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function R(a){const d="\0MK_OPEN\0",h="\0MK_CLOSE\0",c=a.replace(/<mark>/g,d).replace(/<\/mark>/g,h);return s(c).replace(new RegExp(d,"g"),"<mark>").replace(new RegExp(h,"g"),"</mark>")}function N(a){switch(a){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return a}}const j=new URLSearchParams(location.search),_=j.get("id"),H=j.get("q")??"",f=document.getElementById("content");if(!_)f.innerHTML='<p class="empty">No session id.</p>';else{let a=function(e){const t=e==="overview";h.style.display=t?"":"none",c.style.display=t?"none":"",x.classList.toggle("active",t),T.classList.toggle("active",!t),!t&&!w&&(w=!0,z())},d=function(e,t){const i=e.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',g=e.subagent_type?`<span class="sd-chip">${s(e.subagent_type)}</span>`:"",l=`<span class="sd-tool-size">${(e.input_size/1024).toFixed(1)} KB</span>`;let u="";if(e.is_error)if(e.error_text){const o=e.error_text,p=o.length>200?o.slice(0,200)+"…":o;u=o.length>200?`<details class="sd-err-box"><summary>${s(p)}</summary><pre>${s(o)}</pre></details>`:`<div class="sd-err-box">${s(o)}</div>`}else u=`<div class="sd-err-hint">${t?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row">▸ <b>${s(e.tool_name)}</b>${g}${l} ${i}</div>${u}`};$.session(_).then(e=>{if(!e){f.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:i}=e,g=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,l=t.metadata?.sub_agent_session_ids,u=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${y(t.agent_reported_cost_usd)})</span>`:"";f.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${C(g)}</span><span class="kpi-sub">${r(g)} total${l?.length?` · incl. ${l.length} sub-agent${l.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${y(t.total_cost_usd)}</span><span class="kpi-sub">${u}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${r(t.turn_count)}</span><span class="kpi-sub">${i.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${O(t.duration_sec)}</span><span class="kpi-sub">started ${k(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${s(t.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${s(t.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${s(t.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${k(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${s(M)} (${s(I)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?k(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${r(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${r(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${r(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${r(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${s(t.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${s(t.id)}</td></tr>
              </tbody>
            </table>
          </div>

          ${l?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${l.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${l.map(n=>`<li><a href="/session?id=${encodeURIComponent(n)}" class="mono">${s(n)}</a></li>`).join("")}
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${M} (${I})</span>
            </div>
            ${i.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost <span class="est">(est.)</span></th>
                </tr>
              </thead>
              <tbody>
                ${i.map(n=>`
                  <tr>
                    <td class="num">${n.sequence}</td>
                    <td>${b(n.timestamp)}</td>
                    <td><code>${s(n.model)}</code></td>
                    <td class="num tok">${r(n.fresh_input_tokens)}</td>
                    <td class="num tok">${r(n.cache_read_tokens)}</td>
                    <td class="num tok">${r(n.cache_write_tokens)}</td>
                    <td class="num tok">${r(n.output_tokens)}</td>
                    <td class="num">${n.tool_calls_count}</td>
                    <td class="num cost">~${y(n.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const o=document.getElementById("seg-q"),p=document.getElementById("seg-results"),E=document.getElementById("seg-count");let S;async function B(){const n=o.value.trim();if(!n){p.innerHTML="",E.textContent="";return}try{const v=await $.sessionTranscriptSearch(_,n,200);if(E.textContent=`${v.total} match${v.total===1?"":"es"}`,v.segments.length===0){p.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const D=v.segments.slice().sort((m,q)=>Date.parse(m.timestamp)-Date.parse(q.timestamp));p.innerHTML=D.map(m=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${m.role}">${N(m.role)}</span>
                  <span style="margin-left:0.5rem;">${b(m.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${R(m.snippet)}</div>
              </div>
            `).join("")}catch{p.innerHTML='<p class="empty">Search failed.</p>'}}o.addEventListener("input",()=>{clearTimeout(S),S=setTimeout(B,150)}),H&&(o.value=H,B())});const h=document.getElementById("content"),c=document.getElementById("timeline-content"),x=document.getElementById("tab-btn-overview"),T=document.getElementById("tab-btn-timeline");let w=!1;x.addEventListener("click",()=>a("overview")),T.addEventListener("click",()=>a("timeline"));const L=e=>e.fresh_input_tokens+e.output_tokens+e.cache_read_tokens+e.cache_write_tokens;async function z(){const e=await $.sessionTimeline(_);if(!e){c.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(e.turns.length===0){c.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}c.innerHTML=`
          <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <h3 style="margin:0;">Tokens per turn</h3>
              <span style="color:var(--text-2);font-size:0.75rem;">red = turn contains a failed tool call · click a bar to jump</span>
            </div>
            <div id="tl-chart" style="height:180px;margin-top:0.6rem;"></div>
          </div>
          ${e.turns.map(t=>`
            <div class="card" id="tl-turn-${t.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${t.sequence} · ${b(t.timestamp)} · <code>${s(t.model)}</code></span>
                <span><span class="tok">${C(L(t))} tok</span> · <span class="cost">~${y(t.cost_usd)}</span></span>
              </div>
              ${t.tool_calls.length?t.tool_calls.map(i=>d(i,e.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`).join("")}
        `,P(document.getElementById("tl-chart"),e.turns.map(t=>({sequence:t.sequence,tokens:L(t),hasError:t.tool_calls.some(i=>i.is_error===1)})),t=>document.getElementById(`tl-turn-${t}`)?.scrollIntoView({behavior:"smooth",block:"start"}))}}
