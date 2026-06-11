import{a as f,u as v,t as $,n as d,d as O,e as n}from"./format.QZ7NjBLP.js";import{t as R}from"./charts.DIdTcarS.js";const z=Intl.DateTimeFormat().resolvedOptions().timeZone,C=(()=>{const c=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return c?c[0]:""})(),k=o=>o?new Date(o).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",b=o=>o?new Date(o).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function N(o){const c="\0MK_OPEN\0",g="\0MK_CLOSE\0",p=o.replace(/<mark>/g,c).replace(/<\/mark>/g,g);return n(p).replace(new RegExp(c,"g"),"<mark>").replace(new RegExp(g,"g"),"</mark>")}function P(o){switch(o){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return o}}const j=new URLSearchParams(location.search),_=j.get("id"),M=j.get("q")??"",x=document.getElementById("content");if(!_)x.innerHTML='<p class="empty">No session id.</p>';else{let o=function(s){const t=s==="overview";g.style.display=t?"":"none",p.style.display=t?"none":"",w.classList.toggle("active",t),T.classList.toggle("active",!t),!t&&!L&&(L=!0,H())},c=function(s,t){const e=s.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',r=s.subagent_type?`<span class="sd-chip">${n(s.subagent_type)}</span>`:"",l=`<span class="sd-tool-size">${(s.input_size/1024).toFixed(1)} KB</span>`;let h="";if(s.is_error)if(s.error_text){const i=s.error_text,m=i.length>200?i.slice(0,200)+"…":i;h=i.length>200?`<details class="sd-err-box"><summary>${n(m)}</summary><pre>${n(i)}</pre></details>`:`<div class="sd-err-box">${n(i)}</div>`}else h=`<div class="sd-err-hint">${t?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row">▸ <b>${n(s.tool_name)}</b>${r}${l} ${e}</div>${h}`};f.session(_).then(s=>{if(!s){x.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:e}=s,r=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,l=t.metadata?.sub_agent_session_ids,h=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${v(t.agent_reported_cost_usd)})</span>`:"";x.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${$(r)}</span><span class="kpi-sub">${d(r)} total${l?.length?` · incl. ${l.length} sub-agent${l.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${v(t.total_cost_usd)}</span><span class="kpi-sub">${h}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${d(t.turn_count)}</span><span class="kpi-sub">${e.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${O(t.duration_sec)}</span><span class="kpi-sub">started ${k(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${n(t.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${n(t.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${n(t.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${k(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${n(C)} (${n(z)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?k(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${d(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${d(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${d(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${d(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${n(t.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${n(t.id)}</td></tr>
              </tbody>
            </table>
          </div>

          ${l?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${l.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${l.map(a=>`<li><a href="/session?id=${encodeURIComponent(a)}" class="mono">${n(a)}</a></li>`).join("")}
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${C} (${z})</span>
            </div>
            ${e.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost <span class="est">(est.)</span></th>
                </tr>
              </thead>
              <tbody>
                ${e.map(a=>`
                  <tr>
                    <td class="num">${a.sequence}</td>
                    <td>${b(a.timestamp)}</td>
                    <td><code>${n(a.model)}</code></td>
                    <td class="num tok">${d(a.fresh_input_tokens)}</td>
                    <td class="num tok">${d(a.cache_read_tokens)}</td>
                    <td class="num tok">${d(a.cache_write_tokens)}</td>
                    <td class="num tok">${d(a.output_tokens)}</td>
                    <td class="num">${a.tool_calls_count}</td>
                    <td class="num cost">~${v(a.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const i=document.getElementById("seg-q"),m=document.getElementById("seg-results"),S=document.getElementById("seg-count");let B;async function I(){const a=i.value.trim();if(!a){m.innerHTML="",S.textContent="";return}try{const y=await f.sessionTranscriptSearch(_,a,200);if(S.textContent=`${y.total} match${y.total===1?"":"es"}`,y.segments.length===0){m.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const q=y.segments.slice().sort((u,D)=>Date.parse(u.timestamp)-Date.parse(D.timestamp));m.innerHTML=q.map(u=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${u.role}">${P(u.role)}</span>
                  <span style="margin-left:0.5rem;">${b(u.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${N(u.snippet)}</div>
              </div>
            `).join("")}catch{m.innerHTML='<p class="empty">Search failed.</p>'}}i.addEventListener("input",()=>{clearTimeout(B),B=setTimeout(I,150)}),M&&(i.value=M,I())});const g=document.getElementById("content"),p=document.getElementById("timeline-content"),w=document.getElementById("tab-btn-overview"),T=document.getElementById("tab-btn-timeline");let L=!1;w.addEventListener("click",()=>o("overview")),T.addEventListener("click",()=>o("timeline"));const E=s=>s.fresh_input_tokens+s.output_tokens;async function H(){const s=await f.sessionTimeline(_);if(!s){p.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(s.turns.length===0){p.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}p.innerHTML=`
          <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <h3 style="margin:0;">Fresh + output tokens per turn</h3>
              <span style="color:var(--text-2);font-size:0.75rem;">red = turn contains a failed tool call · click a bar to jump · drag the slider to zoom</span>
            </div>
            <div id="tl-chart" style="height:200px;margin-top:0.6rem;"></div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-bottom:0.6rem;">
            <label style="color:var(--text-2);font-size:0.8rem;cursor:pointer;user-select:none;">
              <input type="checkbox" id="tl-fail-only" style="vertical-align:-2px;" /> failures only
            </label>
          </div>
          ${s.turns.map(e=>`
            <div class="card tl-turn" data-fail="${e.tool_calls.some(r=>r.is_error===1)?1:0}" id="tl-turn-${e.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${e.sequence} · ${b(e.timestamp)} · <code>${n(e.model)}</code></span>
                <span><span class="tok">${$(E(e))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${$(e.cache_read_tokens)} cache read</span> · <span class="cost">~${v(e.cost_usd)}</span></span>
              </div>
              ${e.tool_calls.length?e.tool_calls.map(r=>c(r,s.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`).join("")}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `,R(document.getElementById("tl-chart"),s.turns.map(e=>({sequence:e.sequence,tokens:E(e),cacheRead:e.cache_read_tokens,hasError:e.tool_calls.some(r=>r.is_error===1)})),e=>document.getElementById(`tl-turn-${e}`)?.scrollIntoView({behavior:"smooth",block:"start"}));const t=document.getElementById("tl-fail-only");t.addEventListener("change",()=>{let e=0;p.querySelectorAll(".tl-turn").forEach(r=>{const l=!t.checked||r.dataset.fail==="1";r.style.display=l?"":"none",l&&e++}),document.getElementById("tl-fail-empty").style.display=e?"none":""})}}
