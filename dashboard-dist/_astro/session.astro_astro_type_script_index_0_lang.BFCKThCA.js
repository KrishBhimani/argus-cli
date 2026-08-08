import{a as k,u as L,e as o,t as E,n as i,d as O}from"./format.ewPp6he2.js";import{t as Y}from"./charts.Bto8HN55.js";import{p as G}from"./bloom.BDTUDwdd.js";const P=Intl.DateTimeFormat().resolvedOptions().timeZone,F=(()=>{const b=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return b?b[0]:""})(),B=p=>p?new Date(p).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",I=p=>p?new Date(p).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function J(p){const b="\0MK_OPEN\0",w="\0MK_CLOSE\0",S=p.replace(/<mark>/g,b).replace(/<\/mark>/g,w);return o(S).replace(new RegExp(b,"g"),"<mark>").replace(new RegExp(w,"g"),"</mark>")}function W(p){switch(p){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return p}}const Z=new URLSearchParams(location.search),x=Z.get("id"),A=Z.get("q")??"",C=document.getElementById("content");let X=null;const U=()=>X??=k.subagents(x);if(!x)C.innerHTML='<p class="empty">No session id.</p>';else{let p=function(e){S.style.display=e==="overview"?"":"none",_.style.display=e==="timeline"?"":"none",$.style.display=e==="subagents"?"":"none",H.classList.toggle("active",e==="overview"),M.classList.toggle("active",e==="timeline"),j.classList.toggle("active",e==="subagents"),e==="timeline"&&!z&&(z=!0,K()),e==="subagents"&&!D&&(D=!0,V())},b=function(e,n){const r=e.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',u=e.subagent_type?`<span class="sd-chip">${o(e.subagent_type)}</span>`:"",d=`<span class="sd-tool-size">${(e.input_size/1024).toFixed(1)} KB</span>`;let h="";if(e.is_error)if(e.error_text){const c=e.error_text,v=c.length>200?c.slice(0,200)+"…":c;h=c.length>200?`<details class="sd-err-box"><summary>${o(v)}</summary><pre>${o(c)}</pre></details>`:`<div class="sd-err-box">${o(c)}</div>`}else h=`<div class="sd-err-hint">${n?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row${!e.is_error?` tl-expandable" data-tu="${o(e.tool_use_id)}" title="click to show output`:""}">▸ <b>${o(e.tool_name)}</b>${u}${d} ${r}</div>${h}`},w=function(e){const n=e.tools.length?e.tools.map(r=>`<div class="sa-tool${r.errors?" bad":""}"><span>${o(r.name)}</span><span>×${r.count}${r.errors?` · ${r.errors} failed`:""}</span></div>`).join(""):'<p class="sd-no-tools">No tool calls recorded.</p>';return`
          <div class="sa-stats">
            <div><span>Turns</span><b>${i(e.turns)}</b></div>
            <div><span>Tool calls</span><b>${i(e.tool_calls)}</b></div>
            <div><span>Tokens</span><b>${E(e.total_tokens)}</b></div>
            <div><span>Cost (est.)</span><b>~${L(e.cost_usd)}</b></div>
            <div><span>Duration</span><b>${O(e.duration_sec)}</b></div>
            <div><span>Errors</span><b>${i(e.errors)}</b></div>
          </div>
          <div class="sa-task"><b>Task given →</b> ${e.task_given?o(e.task_given):'<span class="sd-no-tools">not available (transcript not indexed)</span>'}</div>
          <h4 style="margin:0.6rem 0 0.3rem;">Tools used</h4>${n}
          <a class="sa-open" href="/session?id=${encodeURIComponent(e.id)}">Open full timeline for this sub-agent →</a>`};k.session(x).then(e=>{if(!e){C.innerHTML='<p class="empty">Session not found.</p>';return}const{session:n,turns:r}=e,u=n.total_fresh_input_tokens+n.total_output_tokens+n.total_cache_read_tokens+n.total_cache_write_tokens,d=n.metadata?.sub_agent_session_ids,h=n.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${L(n.agent_reported_cost_usd)})</span>`:"";if(d?.length){const t=document.getElementById("tab-btn-subagents");t.textContent=`Sub-agents (${d.length})`,t.style.display="",U().then(s=>{if(!s.workflow_runs.length)return;const l=document.getElementById("wf-banner");l.innerHTML=`<span class="dim">Part of workflow${s.workflow_runs.length>1?"s":""}:</span> `+s.workflow_runs.map(a=>`<a href="/workflow?id=${encodeURIComponent(a.run_id)}">${o(a.name||a.run_id)}</a> <span class="dim">${a.agent_count} agents</span>`).join(" &middot; "),l.style.display=""}).catch(()=>{})}C.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${E(u)}</span><span class="kpi-sub">${i(u)} total${d?.length?` · incl. ${d.length} sub-agent${d.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${L(n.total_cost_usd)}</span><span class="kpi-sub">${h}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${i(n.turn_count)}</span><span class="kpi-sub">${r.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${O(n.duration_sec)}</span><span class="kpi-sub">started ${B(n.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${o(n.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${o(n.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${o(n.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${B(n.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${o(F)} (${o(P)})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${n.ended_at?B(n.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${i(n.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${i(n.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${i(n.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${i(n.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${o(n.pricing_table_version)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${o(n.id)}</td></tr>
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${F} (${P})</span>
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
                ${r.map(t=>`
                  <tr>
                    <td class="num">${t.sequence}</td>
                    <td>${I(t.timestamp)}</td>
                    <td><code>${o(t.model)}</code></td>
                    <td class="num tok">${i(t.fresh_input_tokens)}</td>
                    <td class="num tok">${i(t.cache_read_tokens)}</td>
                    <td class="num tok">${i(t.cache_write_tokens)}</td>
                    <td class="num tok">${i(t.output_tokens)}</td>
                    <td class="num">${t.tool_calls_count}</td>
                    <td class="num cost">~${L(t.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const m=document.getElementById("seg-q"),g=document.getElementById("seg-results"),c=document.getElementById("seg-count");let v;async function y(){const t=m.value.trim();if(!t){g.innerHTML="",c.textContent="";return}try{const s=await k.sessionTranscriptSearch(x,t,200);if(c.textContent=`${s.total} match${s.total===1?"":"es"}`,s.segments.length===0){g.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const l=s.segments.slice().sort((a,f)=>Date.parse(a.timestamp)-Date.parse(f.timestamp));g.innerHTML=l.map(a=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${a.role}">${W(a.role)}</span>
                  <span style="margin-left:0.5rem;">${I(a.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${J(a.snippet)}</div>
              </div>
            `).join("")}catch{g.innerHTML='<p class="empty">Search failed.</p>'}}m.addEventListener("input",()=>{clearTimeout(v),v=setTimeout(y,150)}),A&&(m.value=A,y())});const S=document.getElementById("content"),_=document.getElementById("timeline-content"),$=document.getElementById("subagents-content"),H=document.getElementById("tab-btn-overview"),M=document.getElementById("tab-btn-timeline"),j=document.getElementById("tab-btn-subagents");let z=!1,D=!1;H.addEventListener("click",()=>p("overview")),M.addEventListener("click",()=>p("timeline")),j.addEventListener("click",()=>p("subagents"));const N=e=>e.fresh_input_tokens+e.output_tokens;async function K(){const e=await k.sessionTimeline(x);if(!e){_.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(e.turns.length===0){_.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}const n=t=>`
            <div class="card tl-turn" data-fail="${t.tool_calls.some(s=>s.is_error===1)?1:0}" id="tl-turn-${t.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${t.sequence} · ${I(t.timestamp)} · <code>${o(t.model)}</code></span>
                <span><span class="tok">${E(N(t))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${E(t.cache_read_tokens)} cache read</span> · <span class="cost">~${L(t.cost_usd)}</span></span>
              </div>
              ${t.tool_calls.length?t.tool_calls.map(s=>b(s,e.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`,r=150,u=e.turns.map(n);let d=Math.min(u.length,r);const h=e.turns.reduce((t,s)=>t+s.tool_calls.length,0),m=e.turns.reduce((t,s)=>t+s.tool_calls.filter(l=>l.is_error===1).length,0),g=e.turns.filter(t=>t.tool_calls.some(s=>s.is_error===1)).length;_.innerHTML=`
          <div style="display:flex;gap:1.4rem;flex-wrap:wrap;margin-bottom:0.8rem;font-size:0.88rem;color:var(--text-1);">
            <span><b>${i(e.turns.length)}</b> turns</span>
            <span><b>${i(h)}</b> tool calls</span>
            <span style="${m?"color:#f85149;":""}"><b>${i(m)}</b> failed${m?` <span style="color:var(--text-2);">across ${i(g)} turn${g===1?"":"s"}</span>`:""}</span>
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
          <div id="tl-feed">${u.slice(0,d).join("")}</div>
          ${u.length>r?`<button id="tl-more" type="button" style="width:100%;background:none;color:var(--text-2);border:1px dashed var(--border);border-radius:6px;padding:0.5rem;font:inherit;font-size:0.85rem;cursor:pointer;">Show remaining ${u.length-r} turns</button>`:""}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `;const c=document.getElementById("tl-fail-only");function v(){let t=0;_.querySelectorAll(".tl-turn").forEach(s=>{const l=!c.checked||s.dataset.fail==="1";s.style.display=l?"":"none",l&&t++}),document.getElementById("tl-fail-empty").style.display=t?"none":""}function y(){d>=u.length||(document.getElementById("tl-feed").insertAdjacentHTML("beforeend",u.slice(d).join("")),d=u.length,document.getElementById("tl-more")?.remove())}document.getElementById("tl-more")?.addEventListener("click",y),c.addEventListener("change",()=>{c.checked&&y(),v()}),Y(document.getElementById("tl-chart"),e.turns.map(t=>({sequence:t.sequence,tokens:N(t),cacheRead:t.cache_read_tokens,hasError:t.tool_calls.some(s=>s.is_error===1)})),t=>{document.getElementById(`tl-turn-${t}`)||y(),document.getElementById(`tl-turn-${t}`)?.scrollIntoView({behavior:"smooth",block:"start"})}),_.addEventListener("click",async t=>{const s=t.target.closest(".tl-expandable");if(!s)return;const l=s.nextElementSibling;if(l&&l.classList.contains("sd-out-box")){l.remove();return}const a=document.createElement("div");a.className="sd-out-box",a.textContent="loading…",s.after(a);const f=await k.sessionToolOutput(x,s.dataset.tu);f?f.search_enabled?f.found?a.innerHTML=`<pre>${o(f.text)}</pre>`:a.textContent="output not indexed — it may have been empty, or restart argus to backfill":a.textContent="enable search indexing in Settings to see tool output":a.textContent="failed to load output"})}async function V(){$.innerHTML='<p class="empty">Loading sub-agents…</p>';let e=[],n=[];const r=new Map;try{const t=await U();e=t.subagents,n=t.workflow_runs;for(const s of n){const l=await k.workflow(s.run_id);if(l)for(const a of l.agents)r.set(a.sub_session_id,{label:a.label,phase:a.phase_title,phaseIndex:a.phase_index,run:s.run_id})}}catch{$.innerHTML='<p class="empty">Sub-agents unavailable.</p>';return}if(!e.length){$.innerHTML='<p class="empty">No sub-agents.</p>';return}const u=(t,s,l)=>{const a=t.status==="error"?`${t.errors} failed tool call${t.errors===1?"":"s"}`:"no failed tool calls",f=t.status==="error"?`✗ ${i(t.errors)}`:"✓",T=r.get(t.id),Q=T&&T.label?`<span class="sa-phase-dot" style="background:${G(T.phaseIndex)}" title="${o(T.phase)}"></span><strong>${o(T.label)}</strong>`:`<code class="mono">${o(t.model)}</code>`;return`
          <div class="sa-row${l?" sel":""}" data-i="${s}">
            <span class="sa-dot ${t.status}" title="${a}">${f}</span>
            ${Q}
            <span class="sa-meta">${i(t.tool_calls)} tools · ${E(t.total_tokens)}</span>
          </div>`},d=e.map((t,s)=>({sa:t,i:s})),h=new Set,m=[];for(const t of n){const s=d.filter(l=>r.get(l.sa.id)?.run===t.run_id);s.forEach(l=>h.add(l.i)),s.length&&m.push({head:`<div class="sa-group-head"><a href="/workflow?id=${encodeURIComponent(t.run_id)}">${o(t.name||t.run_id)}</a> &middot; ${s.length} agents</div>`,entries:s})}const g=d.filter(t=>!h.has(t.i));g.length&&m.push({head:n.length?`<div class="sa-group-head">Other sub-agents &middot; ${g.length}</div>`:"",entries:g});const c=m[0]?.entries[0],v=m.map(t=>t.head+t.entries.map(s=>u(s.sa,s.i,s===c)).join("")).join("");$.innerHTML=`
          <div class="sa-wrap">
            <div class="sa-list">${v}</div>
            <div class="card sa-detail" id="sa-detail">${w((c??d[0]).sa)}</div>
          </div>`;const y=document.getElementById("sa-detail");$.querySelectorAll(".sa-row").forEach(t=>{t.addEventListener("click",()=>{$.querySelectorAll(".sa-row").forEach(s=>s.classList.remove("sel")),t.classList.add("sel"),y.innerHTML=w(e[Number(t.dataset.i)])})})}const R=document.getElementById("to-top");let q=!1;window.addEventListener("scroll",()=>{const e=window.scrollY>600;e!==q&&(q=e,R.style.display=e?"block":"none")},{passive:!0}),R.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
