import{a as b,u as $,t as k,n as d,d as N,e as a}from"./format.CgLh3UFa.js";import{t as R}from"./charts.CrWnno0Z.js";const M=Intl.DateTimeFormat().resolvedOptions().timeZone,z=(()=>{const u=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return u?u[0]:""})(),x=l=>l?new Date(l).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",w=l=>l?new Date(l).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function P(l){const u="\0MK_OPEN\0",y="\0MK_CLOSE\0",m=l.replace(/<mark>/g,u).replace(/<\/mark>/g,y);return a(m).replace(new RegExp(u,"g"),"<mark>").replace(new RegExp(y,"g"),"</mark>")}function F(l){switch(l){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return l}}const j=new URLSearchParams(location.search),v=j.get("id"),H=j.get("q")??"",T=document.getElementById("content");if(!v)T.innerHTML='<p class="empty">No session id.</p>';else{let l=function(s){const t=s==="overview";y.style.display=t?"":"none",m.style.display=t?"none":"",E.classList.toggle("active",t),L.classList.toggle("active",!t),!t&&!S&&(S=!0,q())},u=function(s,t){const e=s.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',n=s.subagent_type?`<span class="sd-chip">${a(s.subagent_type)}</span>`:"",o=`<span class="sd-tool-size">${(s.input_size/1024).toFixed(1)} KB</span>`;let i="";if(s.is_error)if(s.error_text){const p=s.error_text,_=p.length>200?p.slice(0,200)+"…":p;i=p.length>200?`<details class="sd-err-box"><summary>${a(_)}</summary><pre>${a(p)}</pre></details>`:`<div class="sd-err-box">${a(p)}</div>`}else i=`<div class="sd-err-hint">${t?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row${!s.is_error?` tl-expandable" data-tu="${a(s.tool_use_id)}" title="click to show output`:""}">▸ <b>${a(s.tool_name)}</b>${n}${o} ${e}</div>${i}`};b.session(v).then(s=>{if(!s){T.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:e}=s,n=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,o=t.metadata?.sub_agent_session_ids,i=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${$(t.agent_reported_cost_usd)})</span>`:"";T.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${k(n)}</span><span class="kpi-sub">${d(n)} total${o?.length?` · incl. ${o.length} sub-agent${o.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${$(t.total_cost_usd)}</span><span class="kpi-sub">${i}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${d(t.turn_count)}</span><span class="kpi-sub">${e.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${N(t.duration_sec)}</span><span class="kpi-sub">started ${x(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${a(t.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${a(t.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${a(t.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${x(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${a(z)} (${a(M)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?x(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${d(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${d(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${d(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${d(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${a(t.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${a(t.id)}</td></tr>
              </tbody>
            </table>
          </div>

          ${o?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${o.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${o.map(r=>`<li><a href="/session?id=${encodeURIComponent(r)}" class="mono">${a(r)}</a></li>`).join("")}
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${z} (${M})</span>
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
                ${e.map(r=>`
                  <tr>
                    <td class="num">${r.sequence}</td>
                    <td>${w(r.timestamp)}</td>
                    <td><code>${a(r.model)}</code></td>
                    <td class="num tok">${d(r.fresh_input_tokens)}</td>
                    <td class="num tok">${d(r.cache_read_tokens)}</td>
                    <td class="num tok">${d(r.cache_write_tokens)}</td>
                    <td class="num tok">${d(r.output_tokens)}</td>
                    <td class="num">${r.tool_calls_count}</td>
                    <td class="num cost">~${$(r.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const c=document.getElementById("seg-q"),g=document.getElementById("seg-results"),p=document.getElementById("seg-count");let _;async function I(){const r=c.value.trim();if(!r){g.innerHTML="",p.textContent="";return}try{const f=await b.sessionTranscriptSearch(v,r,200);if(p.textContent=`${f.total} match${f.total===1?"":"es"}`,f.segments.length===0){g.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const D=f.segments.slice().sort((h,O)=>Date.parse(h.timestamp)-Date.parse(O.timestamp));g.innerHTML=D.map(h=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${h.role}">${F(h.role)}</span>
                  <span style="margin-left:0.5rem;">${w(h.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${P(h.snippet)}</div>
              </div>
            `).join("")}catch{g.innerHTML='<p class="empty">Search failed.</p>'}}c.addEventListener("input",()=>{clearTimeout(_),_=setTimeout(I,150)}),H&&(c.value=H,I())});const y=document.getElementById("content"),m=document.getElementById("timeline-content"),E=document.getElementById("tab-btn-overview"),L=document.getElementById("tab-btn-timeline");let S=!1;E.addEventListener("click",()=>l("overview")),L.addEventListener("click",()=>l("timeline"));const B=s=>s.fresh_input_tokens+s.output_tokens;async function q(){const s=await b.sessionTimeline(v);if(!s){m.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(s.turns.length===0){m.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}m.innerHTML=`
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
            <div class="card tl-turn" data-fail="${e.tool_calls.some(n=>n.is_error===1)?1:0}" id="tl-turn-${e.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${e.sequence} · ${w(e.timestamp)} · <code>${a(e.model)}</code></span>
                <span><span class="tok">${k(B(e))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${k(e.cache_read_tokens)} cache read</span> · <span class="cost">~${$(e.cost_usd)}</span></span>
              </div>
              ${e.tool_calls.length?e.tool_calls.map(n=>u(n,s.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`).join("")}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `,R(document.getElementById("tl-chart"),s.turns.map(e=>({sequence:e.sequence,tokens:B(e),cacheRead:e.cache_read_tokens,hasError:e.tool_calls.some(n=>n.is_error===1)})),e=>document.getElementById(`tl-turn-${e}`)?.scrollIntoView({behavior:"smooth",block:"start"}));const t=document.getElementById("tl-fail-only");t.addEventListener("change",()=>{let e=0;m.querySelectorAll(".tl-turn").forEach(n=>{const o=!t.checked||n.dataset.fail==="1";n.style.display=o?"":"none",o&&e++}),document.getElementById("tl-fail-empty").style.display=e?"none":""}),m.addEventListener("click",async e=>{const n=e.target.closest(".tl-expandable");if(!n)return;const o=n.nextElementSibling;if(o&&o.classList.contains("sd-out-box")){o.remove();return}const i=document.createElement("div");i.className="sd-out-box",i.textContent="loading…",n.after(i);const c=await b.sessionToolOutput(v,n.dataset.tu);c?c.search_enabled?c.found?i.innerHTML=`<pre>${a(c.text)}</pre>`:i.textContent="output not indexed — it may have been empty, or restart argus to backfill":i.textContent="enable search indexing in Settings to see tool output":i.textContent="failed to load output"})}const C=document.getElementById("to-top");window.addEventListener("scroll",()=>{C.style.display=window.scrollY>600?"block":"none"},{passive:!0}),C.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
