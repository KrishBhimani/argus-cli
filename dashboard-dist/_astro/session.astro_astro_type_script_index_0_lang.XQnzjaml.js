import{a as $,u as k,t as x,n as d,d as R,e as o}from"./format.CgLh3UFa.js";import{t as F}from"./charts.C_St214A.js";const H=Intl.DateTimeFormat().resolvedOptions().timeZone,z=(()=>{const v=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return v?v[0]:""})(),w=r=>r?new Date(r).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",T=r=>r?new Date(r).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function P(r){const v="\0MK_OPEN\0",_="\0MK_CLOSE\0",g=r.replace(/<mark>/g,v).replace(/<\/mark>/g,_);return o(g).replace(new RegExp(v,"g"),"<mark>").replace(new RegExp(_,"g"),"</mark>")}function A(r){switch(r){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return r}}const D=new URLSearchParams(location.search),b=D.get("id"),j=D.get("q")??"",E=document.getElementById("content");if(!b)E.innerHTML='<p class="empty">No session id.</p>';else{let r=function(s){const t=s==="overview";_.style.display=t?"":"none",g.style.display=t?"none":"",L.classList.toggle("active",t),B.classList.toggle("active",!t),!t&&!S&&(S=!0,q())},v=function(s,t){const c=s.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',i=s.subagent_type?`<span class="sd-chip">${o(s.subagent_type)}</span>`:"",l=`<span class="sd-tool-size">${(s.input_size/1024).toFixed(1)} KB</span>`;let p="";if(s.is_error)if(s.error_text){const e=s.error_text,a=e.length>200?e.slice(0,200)+"…":e;p=e.length>200?`<details class="sd-err-box"><summary>${o(a)}</summary><pre>${o(e)}</pre></details>`:`<div class="sd-err-box">${o(e)}</div>`}else p=`<div class="sd-err-hint">${t?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row${!s.is_error?` tl-expandable" data-tu="${o(s.tool_use_id)}" title="click to show output`:""}">▸ <b>${o(s.tool_name)}</b>${i}${l} ${c}</div>${p}`};$.session(b).then(s=>{if(!s){E.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:c}=s,i=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,l=t.metadata?.sub_agent_session_ids,p=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${k(t.agent_reported_cost_usd)})</span>`:"";E.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${x(i)}</span><span class="kpi-sub">${d(i)} total${l?.length?` · incl. ${l.length} sub-agent${l.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${k(t.total_cost_usd)}</span><span class="kpi-sub">${p}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${d(t.turn_count)}</span><span class="kpi-sub">${c.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${R(t.duration_sec)}</span><span class="kpi-sub">started ${w(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${o(t.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${o(t.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${o(t.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${w(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${o(z)} (${o(H)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?w(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${d(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${d(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${d(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${d(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${o(t.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${o(t.id)}</td></tr>
              </tbody>
            </table>
          </div>

          ${l?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${l.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${l.map(n=>`<li><a href="/session?id=${encodeURIComponent(n)}" class="mono">${o(n)}</a></li>`).join("")}
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${z} (${H})</span>
            </div>
            ${c.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost <span class="est">(est.)</span></th>
                </tr>
              </thead>
              <tbody>
                ${c.map(n=>`
                  <tr>
                    <td class="num">${n.sequence}</td>
                    <td>${T(n.timestamp)}</td>
                    <td><code>${o(n.model)}</code></td>
                    <td class="num tok">${d(n.fresh_input_tokens)}</td>
                    <td class="num tok">${d(n.cache_read_tokens)}</td>
                    <td class="num tok">${d(n.cache_write_tokens)}</td>
                    <td class="num tok">${d(n.output_tokens)}</td>
                    <td class="num">${n.tool_calls_count}</td>
                    <td class="num cost">~${k(n.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const y=document.getElementById("seg-q"),m=document.getElementById("seg-results"),e=document.getElementById("seg-count");let a;async function u(){const n=y.value.trim();if(!n){m.innerHTML="",e.textContent="";return}try{const h=await $.sessionTranscriptSearch(b,n,200);if(e.textContent=`${h.total} match${h.total===1?"":"es"}`,h.segments.length===0){m.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const N=h.segments.slice().sort((f,O)=>Date.parse(f.timestamp)-Date.parse(O.timestamp));m.innerHTML=N.map(f=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${f.role}">${A(f.role)}</span>
                  <span style="margin-left:0.5rem;">${T(f.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${P(f.snippet)}</div>
              </div>
            `).join("")}catch{m.innerHTML='<p class="empty">Search failed.</p>'}}y.addEventListener("input",()=>{clearTimeout(a),a=setTimeout(u,150)}),j&&(y.value=j,u())});const _=document.getElementById("content"),g=document.getElementById("timeline-content"),L=document.getElementById("tab-btn-overview"),B=document.getElementById("tab-btn-timeline");let S=!1;L.addEventListener("click",()=>r("overview")),B.addEventListener("click",()=>r("timeline"));const I=s=>s.fresh_input_tokens+s.output_tokens;async function q(){const s=await $.sessionTimeline(b);if(!s){g.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(s.turns.length===0){g.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}const t=e=>`
            <div class="card tl-turn" data-fail="${e.tool_calls.some(a=>a.is_error===1)?1:0}" id="tl-turn-${e.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${e.sequence} · ${T(e.timestamp)} · <code>${o(e.model)}</code></span>
                <span><span class="tok">${x(I(e))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${x(e.cache_read_tokens)} cache read</span> · <span class="cost">~${k(e.cost_usd)}</span></span>
              </div>
              ${e.tool_calls.length?e.tool_calls.map(a=>v(a,s.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`,c=150,i=s.turns.map(t);let l=Math.min(i.length,c);g.innerHTML=`
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
          <div id="tl-feed">${i.slice(0,l).join("")}</div>
          ${i.length>c?`<button id="tl-more" type="button" style="width:100%;background:none;color:var(--text-2);border:1px dashed var(--border);border-radius:6px;padding:0.5rem;font:inherit;font-size:0.85rem;cursor:pointer;">Show remaining ${i.length-c} turns</button>`:""}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `;const p=document.getElementById("tl-fail-only");function y(){let e=0;g.querySelectorAll(".tl-turn").forEach(a=>{const u=!p.checked||a.dataset.fail==="1";a.style.display=u?"":"none",u&&e++}),document.getElementById("tl-fail-empty").style.display=e?"none":""}function m(){l>=i.length||(document.getElementById("tl-feed").insertAdjacentHTML("beforeend",i.slice(l).join("")),l=i.length,document.getElementById("tl-more")?.remove())}document.getElementById("tl-more")?.addEventListener("click",m),p.addEventListener("change",()=>{p.checked&&m(),y()}),F(document.getElementById("tl-chart"),s.turns.map(e=>({sequence:e.sequence,tokens:I(e),cacheRead:e.cache_read_tokens,hasError:e.tool_calls.some(a=>a.is_error===1)})),e=>{document.getElementById(`tl-turn-${e}`)||m(),document.getElementById(`tl-turn-${e}`)?.scrollIntoView({behavior:"smooth",block:"start"})}),g.addEventListener("click",async e=>{const a=e.target.closest(".tl-expandable");if(!a)return;const u=a.nextElementSibling;if(u&&u.classList.contains("sd-out-box")){u.remove();return}const n=document.createElement("div");n.className="sd-out-box",n.textContent="loading…",a.after(n);const h=await $.sessionToolOutput(b,a.dataset.tu);h?h.search_enabled?h.found?n.innerHTML=`<pre>${o(h.text)}</pre>`:n.textContent="output not indexed — it may have been empty, or restart argus to backfill":n.textContent="enable search indexing in Settings to see tool output":n.textContent="failed to load output"})}const C=document.getElementById("to-top");let M=!1;window.addEventListener("scroll",()=>{const s=window.scrollY>600;s!==M&&(M=s,C.style.display=s?"block":"none")},{passive:!0}),C.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
