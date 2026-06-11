import{a as x,u as w,t as T,n as l,d as R,e as a}from"./format.CgLh3UFa.js";import{t as F}from"./charts.C_St214A.js";const j=Intl.DateTimeFormat().resolvedOptions().timeZone,D=(()=>{const v=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return v?v[0]:""})(),E=o=>o?new Date(o).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",L=o=>o?new Date(o).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function P(o){const v="\0MK_OPEN\0",k="\0MK_CLOSE\0",m=o.replace(/<mark>/g,v).replace(/<\/mark>/g,k);return a(m).replace(new RegExp(v,"g"),"<mark>").replace(new RegExp(k,"g"),"</mark>")}function A(o){switch(o){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return o}}const N=new URLSearchParams(location.search),$=N.get("id"),q=N.get("q")??"",B=document.getElementById("content");if(!$)B.innerHTML='<p class="empty">No session id.</p>';else{let o=function(s){const e=s==="overview";k.style.display=e?"":"none",m.style.display=e?"none":"",S.classList.toggle("active",e),C.classList.toggle("active",!e),!e&&!I&&(I=!0,O())},v=function(s,e){const u=s.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',c=s.subagent_type?`<span class="sd-chip">${a(s.subagent_type)}</span>`:"",i=`<span class="sd-tool-size">${(s.input_size/1024).toFixed(1)} KB</span>`;let y="";if(s.is_error)if(s.error_text){const d=s.error_text,f=d.length>200?d.slice(0,200)+"…":d;y=d.length>200?`<details class="sd-err-box"><summary>${a(f)}</summary><pre>${a(d)}</pre></details>`:`<div class="sd-err-box">${a(d)}</div>`}else y=`<div class="sd-err-hint">${e?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row${!s.is_error?` tl-expandable" data-tu="${a(s.tool_use_id)}" title="click to show output`:""}">▸ <b>${a(s.tool_name)}</b>${c}${i} ${u}</div>${y}`};x.session($).then(s=>{if(!s){B.innerHTML='<p class="empty">Session not found.</p>';return}const{session:e,turns:u}=s,c=e.total_fresh_input_tokens+e.total_output_tokens+e.total_cache_read_tokens+e.total_cache_write_tokens,i=e.metadata?.sub_agent_session_ids,y=e.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${w(e.agent_reported_cost_usd)})</span>`:"";B.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${T(c)}</span><span class="kpi-sub">${l(c)} total${i?.length?` · incl. ${i.length} sub-agent${i.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${w(e.total_cost_usd)}</span><span class="kpi-sub">${y}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${l(e.turn_count)}</span><span class="kpi-sub">${u.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${R(e.duration_sec)}</span><span class="kpi-sub">started ${E(e.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${a(e.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${a(e.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${a(e.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${E(e.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${a(D)} (${a(j)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${e.ended_at?E(e.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${l(e.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${l(e.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${l(e.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${l(e.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${a(e.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${a(e.id)}</td></tr>
              </tbody>
            </table>
          </div>

          ${i?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${i.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${i.map(t=>`<li><a href="/session?id=${encodeURIComponent(t)}" class="mono">${a(t)}</a></li>`).join("")}
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${D} (${j})</span>
            </div>
            ${u.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost <span class="est">(est.)</span></th>
                </tr>
              </thead>
              <tbody>
                ${u.map(t=>`
                  <tr>
                    <td class="num">${t.sequence}</td>
                    <td>${L(t.timestamp)}</td>
                    <td><code>${a(t.model)}</code></td>
                    <td class="num tok">${l(t.fresh_input_tokens)}</td>
                    <td class="num tok">${l(t.cache_read_tokens)}</td>
                    <td class="num tok">${l(t.cache_write_tokens)}</td>
                    <td class="num tok">${l(t.output_tokens)}</td>
                    <td class="num">${t.tool_calls_count}</td>
                    <td class="num cost">~${w(t.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const h=document.getElementById("seg-q"),g=document.getElementById("seg-results"),d=document.getElementById("seg-count");let f;async function b(){const t=h.value.trim();if(!t){g.innerHTML="",d.textContent="";return}try{const n=await x.sessionTranscriptSearch($,t,200);if(d.textContent=`${n.total} match${n.total===1?"":"es"}`,n.segments.length===0){g.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const p=n.segments.slice().sort((r,_)=>Date.parse(r.timestamp)-Date.parse(_.timestamp));g.innerHTML=p.map(r=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${r.role}">${A(r.role)}</span>
                  <span style="margin-left:0.5rem;">${L(r.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${P(r.snippet)}</div>
              </div>
            `).join("")}catch{g.innerHTML='<p class="empty">Search failed.</p>'}}h.addEventListener("input",()=>{clearTimeout(f),f=setTimeout(b,150)}),q&&(h.value=q,b())});const k=document.getElementById("content"),m=document.getElementById("timeline-content"),S=document.getElementById("tab-btn-overview"),C=document.getElementById("tab-btn-timeline");let I=!1;S.addEventListener("click",()=>o("overview")),C.addEventListener("click",()=>o("timeline"));const M=s=>s.fresh_input_tokens+s.output_tokens;async function O(){const s=await x.sessionTimeline($);if(!s){m.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(s.turns.length===0){m.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}const e=t=>`
            <div class="card tl-turn" data-fail="${t.tool_calls.some(n=>n.is_error===1)?1:0}" id="tl-turn-${t.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${t.sequence} · ${L(t.timestamp)} · <code>${a(t.model)}</code></span>
                <span><span class="tok">${T(M(t))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${T(t.cache_read_tokens)} cache read</span> · <span class="cost">~${w(t.cost_usd)}</span></span>
              </div>
              ${t.tool_calls.length?t.tool_calls.map(n=>v(n,s.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`,u=150,c=s.turns.map(e);let i=Math.min(c.length,u);const y=s.turns.reduce((t,n)=>t+n.tool_calls.length,0),h=s.turns.reduce((t,n)=>t+n.tool_calls.filter(p=>p.is_error===1).length,0),g=s.turns.filter(t=>t.tool_calls.some(n=>n.is_error===1)).length;m.innerHTML=`
          <div style="display:flex;gap:1.4rem;flex-wrap:wrap;margin-bottom:0.8rem;font-size:0.88rem;color:var(--text-1);">
            <span><b>${l(s.turns.length)}</b> turns</span>
            <span><b>${l(y)}</b> tool calls</span>
            <span style="${h?"color:#f85149;":""}"><b>${l(h)}</b> failed${h?` <span style="color:var(--text-2);">across ${l(g)} turn${g===1?"":"s"}</span>`:""}</span>
          </div>
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
          <div id="tl-feed">${c.slice(0,i).join("")}</div>
          ${c.length>u?`<button id="tl-more" type="button" style="width:100%;background:none;color:var(--text-2);border:1px dashed var(--border);border-radius:6px;padding:0.5rem;font:inherit;font-size:0.85rem;cursor:pointer;">Show remaining ${c.length-u} turns</button>`:""}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `;const d=document.getElementById("tl-fail-only");function f(){let t=0;m.querySelectorAll(".tl-turn").forEach(n=>{const p=!d.checked||n.dataset.fail==="1";n.style.display=p?"":"none",p&&t++}),document.getElementById("tl-fail-empty").style.display=t?"none":""}function b(){i>=c.length||(document.getElementById("tl-feed").insertAdjacentHTML("beforeend",c.slice(i).join("")),i=c.length,document.getElementById("tl-more")?.remove())}document.getElementById("tl-more")?.addEventListener("click",b),d.addEventListener("change",()=>{d.checked&&b(),f()}),F(document.getElementById("tl-chart"),s.turns.map(t=>({sequence:t.sequence,tokens:M(t),cacheRead:t.cache_read_tokens,hasError:t.tool_calls.some(n=>n.is_error===1)})),t=>{document.getElementById(`tl-turn-${t}`)||b(),document.getElementById(`tl-turn-${t}`)?.scrollIntoView({behavior:"smooth",block:"start"})}),m.addEventListener("click",async t=>{const n=t.target.closest(".tl-expandable");if(!n)return;const p=n.nextElementSibling;if(p&&p.classList.contains("sd-out-box")){p.remove();return}const r=document.createElement("div");r.className="sd-out-box",r.textContent="loading…",n.after(r);const _=await x.sessionToolOutput($,n.dataset.tu);_?_.search_enabled?_.found?r.innerHTML=`<pre>${a(_.text)}</pre>`:r.textContent="output not indexed — it may have been empty, or restart argus to backfill":r.textContent="enable search indexing in Settings to see tool output":r.textContent="failed to load output"})}const z=document.getElementById("to-top");let H=!1;window.addEventListener("scroll",()=>{const s=window.scrollY>600;s!==H&&(H=s,z.style.display=s?"block":"none")},{passive:!0}),z.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
