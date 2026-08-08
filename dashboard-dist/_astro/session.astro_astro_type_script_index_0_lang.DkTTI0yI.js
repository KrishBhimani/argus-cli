import{a as k,u as T,t as L,n as l,d as R,e as o}from"./format.ewPp6he2.js";import{t as K}from"./charts.Bto8HN55.js";const F=Intl.DateTimeFormat().resolvedOptions().timeZone,O=(()=>{const b=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return b?b[0]:""})(),B=c=>c?new Date(c).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",S=c=>c?new Date(c).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function V(c){const b="\0MK_OPEN\0",w="\0MK_CLOSE\0",E=c.replace(/<mark>/g,b).replace(/<\/mark>/g,w);return o(E).replace(new RegExp(b,"g"),"<mark>").replace(new RegExp(w,"g"),"</mark>")}function Q(c){switch(c){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return c}}const A=new URLSearchParams(location.search),x=A.get("id"),P=A.get("q")??"",I=document.getElementById("content");if(!x)I.innerHTML='<p class="empty">No session id.</p>';else{let c=function(t){E.style.display=t==="overview"?"":"none",$.style.display=t==="timeline"?"":"none",f.style.display=t==="subagents"?"":"none",C.classList.toggle("active",t==="overview"),M.classList.toggle("active",t==="timeline"),H.classList.toggle("active",t==="subagents"),t==="timeline"&&!j&&(j=!0,U()),t==="subagents"&&!z&&(z=!0,Z())},b=function(t,s){const r=t.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',p=t.subagent_type?`<span class="sd-chip">${o(t.subagent_type)}</span>`:"",u=`<span class="sd-tool-size">${(t.input_size/1024).toFixed(1)} KB</span>`;let y="";if(t.is_error)if(t.error_text){const i=t.error_text,g=i.length>200?i.slice(0,200)+"…":i;y=i.length>200?`<details class="sd-err-box"><summary>${o(g)}</summary><pre>${o(i)}</pre></details>`:`<div class="sd-err-box">${o(i)}</div>`}else y=`<div class="sd-err-hint">${s?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row${!t.is_error?` tl-expandable" data-tu="${o(t.tool_use_id)}" title="click to show output`:""}">▸ <b>${o(t.tool_name)}</b>${p}${u} ${r}</div>${y}`},w=function(t){const s=t.tools.length?t.tools.map(r=>`<div class="sa-tool${r.errors?" bad":""}"><span>${o(r.name)}</span><span>×${r.count}${r.errors?` · ${r.errors} failed`:""}</span></div>`).join(""):'<p class="sd-no-tools">No tool calls recorded.</p>';return`
          <div class="sa-stats">
            <div><span>Turns</span><b>${l(t.turns)}</b></div>
            <div><span>Tool calls</span><b>${l(t.tool_calls)}</b></div>
            <div><span>Tokens</span><b>${L(t.total_tokens)}</b></div>
            <div><span>Cost (est.)</span><b>~${T(t.cost_usd)}</b></div>
            <div><span>Duration</span><b>${R(t.duration_sec)}</b></div>
            <div><span>Errors</span><b>${l(t.errors)}</b></div>
          </div>
          <div class="sa-task"><b>Task given →</b> ${t.task_given?o(t.task_given):'<span class="sd-no-tools">not available (transcript not indexed)</span>'}</div>
          <h4 style="margin:0.6rem 0 0.3rem;">Tools used</h4>${s}
          <a class="sa-open" href="/session?id=${encodeURIComponent(t.id)}">Open full timeline for this sub-agent →</a>`};k.session(x).then(t=>{if(!t){I.innerHTML='<p class="empty">Session not found.</p>';return}const{session:s,turns:r}=t,p=s.total_fresh_input_tokens+s.total_output_tokens+s.total_cache_read_tokens+s.total_cache_write_tokens,u=s.metadata?.sub_agent_session_ids,y=s.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${T(s.agent_reported_cost_usd)})</span>`:"";if(u?.length){const e=document.getElementById("tab-btn-subagents");e.textContent=`Sub-agents (${u.length})`,e.style.display=""}I.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${L(p)}</span><span class="kpi-sub">${l(p)} total${u?.length?` · incl. ${u.length} sub-agent${u.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${T(s.total_cost_usd)}</span><span class="kpi-sub">${y}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${l(s.turn_count)}</span><span class="kpi-sub">${r.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${R(s.duration_sec)}</span><span class="kpi-sub">started ${B(s.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${o(s.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${o(s.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${o(s.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${B(s.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${o(O)} (${o(F)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${s.ended_at?B(s.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${l(s.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${l(s.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${l(s.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${l(s.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${o(s.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${o(s.id)}</td></tr>
              </tbody>
            </table>
          </div>

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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${O} (${F})</span>
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
                    <td>${S(e.timestamp)}</td>
                    <td><code>${o(e.model)}</code></td>
                    <td class="num tok">${l(e.fresh_input_tokens)}</td>
                    <td class="num tok">${l(e.cache_read_tokens)}</td>
                    <td class="num tok">${l(e.cache_write_tokens)}</td>
                    <td class="num tok">${l(e.output_tokens)}</td>
                    <td class="num">${e.tool_calls_count}</td>
                    <td class="num cost">~${T(e.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const n=document.getElementById("seg-q"),d=document.getElementById("seg-results"),i=document.getElementById("seg-count");let g;async function v(){const e=n.value.trim();if(!e){d.innerHTML="",i.textContent="";return}try{const a=await k.sessionTranscriptSearch(x,e,200);if(i.textContent=`${a.total} match${a.total===1?"":"es"}`,a.segments.length===0){d.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const h=a.segments.slice().sort((m,_)=>Date.parse(m.timestamp)-Date.parse(_.timestamp));d.innerHTML=h.map(m=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${m.role}">${Q(m.role)}</span>
                  <span style="margin-left:0.5rem;">${S(m.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${V(m.snippet)}</div>
              </div>
            `).join("")}catch{d.innerHTML='<p class="empty">Search failed.</p>'}}n.addEventListener("input",()=>{clearTimeout(g),g=setTimeout(v,150)}),P&&(n.value=P,v())});const E=document.getElementById("content"),$=document.getElementById("timeline-content"),f=document.getElementById("subagents-content"),C=document.getElementById("tab-btn-overview"),M=document.getElementById("tab-btn-timeline"),H=document.getElementById("tab-btn-subagents");let j=!1,z=!1;C.addEventListener("click",()=>c("overview")),M.addEventListener("click",()=>c("timeline")),H.addEventListener("click",()=>c("subagents"));const D=t=>t.fresh_input_tokens+t.output_tokens;async function U(){const t=await k.sessionTimeline(x);if(!t){$.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(t.turns.length===0){$.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}const s=e=>`
            <div class="card tl-turn" data-fail="${e.tool_calls.some(a=>a.is_error===1)?1:0}" id="tl-turn-${e.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${e.sequence} · ${S(e.timestamp)} · <code>${o(e.model)}</code></span>
                <span><span class="tok">${L(D(e))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${L(e.cache_read_tokens)} cache read</span> · <span class="cost">~${T(e.cost_usd)}</span></span>
              </div>
              ${e.tool_calls.length?e.tool_calls.map(a=>b(a,t.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`,r=150,p=t.turns.map(s);let u=Math.min(p.length,r);const y=t.turns.reduce((e,a)=>e+a.tool_calls.length,0),n=t.turns.reduce((e,a)=>e+a.tool_calls.filter(h=>h.is_error===1).length,0),d=t.turns.filter(e=>e.tool_calls.some(a=>a.is_error===1)).length;$.innerHTML=`
          <div style="display:flex;gap:1.4rem;flex-wrap:wrap;margin-bottom:0.8rem;font-size:0.88rem;color:var(--text-1);">
            <span><b>${l(t.turns.length)}</b> turns</span>
            <span><b>${l(y)}</b> tool calls</span>
            <span style="${n?"color:#f85149;":""}"><b>${l(n)}</b> failed${n?` <span style="color:var(--text-2);">across ${l(d)} turn${d===1?"":"s"}</span>`:""}</span>
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
          <div id="tl-feed">${p.slice(0,u).join("")}</div>
          ${p.length>r?`<button id="tl-more" type="button" style="width:100%;background:none;color:var(--text-2);border:1px dashed var(--border);border-radius:6px;padding:0.5rem;font:inherit;font-size:0.85rem;cursor:pointer;">Show remaining ${p.length-r} turns</button>`:""}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `;const i=document.getElementById("tl-fail-only");function g(){let e=0;$.querySelectorAll(".tl-turn").forEach(a=>{const h=!i.checked||a.dataset.fail==="1";a.style.display=h?"":"none",h&&e++}),document.getElementById("tl-fail-empty").style.display=e?"none":""}function v(){u>=p.length||(document.getElementById("tl-feed").insertAdjacentHTML("beforeend",p.slice(u).join("")),u=p.length,document.getElementById("tl-more")?.remove())}document.getElementById("tl-more")?.addEventListener("click",v),i.addEventListener("change",()=>{i.checked&&v(),g()}),K(document.getElementById("tl-chart"),t.turns.map(e=>({sequence:e.sequence,tokens:D(e),cacheRead:e.cache_read_tokens,hasError:e.tool_calls.some(a=>a.is_error===1)})),e=>{document.getElementById(`tl-turn-${e}`)||v(),document.getElementById(`tl-turn-${e}`)?.scrollIntoView({behavior:"smooth",block:"start"})}),$.addEventListener("click",async e=>{const a=e.target.closest(".tl-expandable");if(!a)return;const h=a.nextElementSibling;if(h&&h.classList.contains("sd-out-box")){h.remove();return}const m=document.createElement("div");m.className="sd-out-box",m.textContent="loading…",a.after(m);const _=await k.sessionToolOutput(x,a.dataset.tu);_?_.search_enabled?_.found?m.innerHTML=`<pre>${o(_.text)}</pre>`:m.textContent="output not indexed — it may have been empty, or restart argus to backfill":m.textContent="enable search indexing in Settings to see tool output":m.textContent="failed to load output"})}async function Z(){f.innerHTML='<p class="empty">Loading sub-agents…</p>';let t=[],s=[];const r=new Map;try{const n=await k.subagents(x);t=n.subagents,s=n.workflow_runs;for(const d of s){const i=await k.workflow(d.run_id);if(i)for(const g of i.agents)r.set(g.sub_session_id,{label:g.label,phase:g.phase_title,run:d.run_id})}}catch{f.innerHTML='<p class="empty">Sub-agents unavailable.</p>';return}if(!t.length){f.innerHTML='<p class="empty">No sub-agents.</p>';return}const p=s.length?`<p class="dim" style="margin:0 0 0.6rem;">From ${s.map(n=>`<a href="/workflow?id=${encodeURIComponent(n.run_id)}">${o(n.name||n.run_id)}</a> (${n.agent_count} agents)`).join(", ")}</p>`:"",u=t.map((n,d)=>{const i=n.status==="error"?`${n.errors} failed tool call${n.errors===1?"":"s"}`:"no failed tool calls",g=n.status==="error"?`✗ ${l(n.errors)}`:"✓",v=r.get(n.id),e=v&&v.label?`<strong>${o(v.label)}</strong> <span class="dim">${o(v.phase)}</span>`:`<code class="mono">${o(n.model)}</code>`;return`
          <div class="sa-row${d===0?" sel":""}" data-i="${d}">
            <span class="sa-dot ${n.status}" title="${i}">${g}</span>
            ${e}
            <span class="sa-meta">${l(n.tool_calls)} tools · ${L(n.total_tokens)}</span>
          </div>`}).join("");f.innerHTML=`
          ${p}
          <div class="sa-wrap">
            <div class="sa-list">${u}</div>
            <div class="card sa-detail" id="sa-detail">${w(t[0])}</div>
          </div>`;const y=document.getElementById("sa-detail");f.querySelectorAll(".sa-row").forEach(n=>{n.addEventListener("click",()=>{f.querySelectorAll(".sa-row").forEach(d=>d.classList.remove("sel")),n.classList.add("sel"),y.innerHTML=w(t[Number(n.dataset.i)])})})}const N=document.getElementById("to-top");let q=!1;window.addEventListener("scroll",()=>{const t=window.scrollY>600;t!==q&&(q=t,N.style.display=t?"block":"none")},{passive:!0}),N.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
