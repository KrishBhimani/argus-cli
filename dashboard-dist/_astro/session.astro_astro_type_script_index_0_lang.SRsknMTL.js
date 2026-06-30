import{a as T,u as w,t as L,n as l,d as O,e as o}from"./format.BexCUztC.js";import{t as U}from"./charts.36uaSAWt.js";const R=Intl.DateTimeFormat().resolvedOptions().timeZone,F=(()=>{const h=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return h?h[0]:""})(),B=d=>d?new Date(d).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",S=d=>d?new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—";function V(d){const h="\0MK_OPEN\0",x="\0MK_CLOSE\0",E=d.replace(/<mark>/g,h).replace(/<\/mark>/g,x);return o(E).replace(new RegExp(h,"g"),"<mark>").replace(new RegExp(x,"g"),"</mark>")}function Q(d){switch(d){case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return d}}const A=new URLSearchParams(location.search),k=A.get("id"),P=A.get("q")??"",I=document.getElementById("content");if(!k)I.innerHTML='<p class="empty">No session id.</p>';else{let d=function(t){E.style.display=t==="overview"?"":"none",b.style.display=t==="timeline"?"":"none",y.style.display=t==="subagents"?"":"none",C.classList.toggle("active",t==="overview"),M.classList.toggle("active",t==="timeline"),H.classList.toggle("active",t==="subagents"),t==="timeline"&&!j&&(j=!0,Z()),t==="subagents"&&!z&&(z=!0,K())},h=function(t,s){const r=t.is_error?'<span class="fail">✗ failed</span>':'<span class="ok">✓</span>',n=t.subagent_type?`<span class="sd-chip">${o(t.subagent_type)}</span>`:"",i=`<span class="sd-tool-size">${(t.input_size/1024).toFixed(1)} KB</span>`;let g="";if(t.is_error)if(t.error_text){const p=t.error_text,f=p.length>200?p.slice(0,200)+"…":p;g=p.length>200?`<details class="sd-err-box"><summary>${o(f)}</summary><pre>${o(p)}</pre></details>`:`<div class="sd-err-box">${o(p)}</div>`}else g=`<div class="sd-err-hint">${s?"error output not indexed yet — restart argus (or argusd) and reload":"enable search indexing in Settings to see error output"}</div>`;return`<div class="sd-tool-row${!t.is_error?` tl-expandable" data-tu="${o(t.tool_use_id)}" title="click to show output`:""}">▸ <b>${o(t.tool_name)}</b>${n}${i} ${r}</div>${g}`},x=function(t){const s=t.tools.length?t.tools.map(r=>`<div class="sa-tool${r.errors?" bad":""}"><span>${o(r.name)}</span><span>×${r.count}${r.errors?` · ${r.errors} failed`:""}</span></div>`).join(""):'<p class="sd-no-tools">No tool calls recorded.</p>';return`
          <div class="sa-stats">
            <div><span>Turns</span><b>${l(t.turns)}</b></div>
            <div><span>Tool calls</span><b>${l(t.tool_calls)}</b></div>
            <div><span>Tokens</span><b>${L(t.total_tokens)}</b></div>
            <div><span>Cost (est.)</span><b>~${w(t.cost_usd)}</b></div>
            <div><span>Duration</span><b>${O(t.duration_sec)}</b></div>
            <div><span>Errors</span><b>${l(t.errors)}</b></div>
          </div>
          <div class="sa-task"><b>Task given →</b> ${t.task_given?o(t.task_given):'<span class="sd-no-tools">not available (transcript not indexed)</span>'}</div>
          <h4 style="margin:0.6rem 0 0.3rem;">Tools used</h4>${s}
          <a class="sa-open" href="/session?id=${encodeURIComponent(t.id)}">Open full timeline for this sub-agent →</a>`};T.session(k).then(t=>{if(!t){I.innerHTML='<p class="empty">Session not found.</p>';return}const{session:s,turns:r}=t,n=s.total_fresh_input_tokens+s.total_output_tokens+s.total_cache_read_tokens+s.total_cache_write_tokens,i=s.metadata?.sub_agent_session_ids,g=s.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${w(s.agent_reported_cost_usd)})</span>`:"";if(i?.length){const e=document.getElementById("tab-btn-subagents");e.textContent=`Sub-agents (${i.length})`,e.style.display=""}I.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value tokens">${L(n)}</span><span class="kpi-sub">${l(n)} total${i?.length?` · incl. ${i.length} sub-agent${i.length===1?"":"s"}`:""}</span></div>
            <div class="card kpi"><span class="kpi-label">Cost <span style="color:var(--text-2);font-weight:400;">(est.)</span></span><span class="kpi-value cost">~${w(s.total_cost_usd)}</span><span class="kpi-sub">${g}</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${l(s.turn_count)}</span><span class="kpi-sub">${r.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${O(s.duration_sec)}</span><span class="kpi-sub">started ${B(s.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Claude Code</td><td><code>${o(s.agent_version??"—")}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${o(s.project_path||"—")}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${o(s.primary_model)}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${B(s.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${o(F)} (${o(R)})</span></td></tr>
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
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${F} (${R})</span>
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
                    <td class="num cost">~${w(e.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `;const u=document.getElementById("seg-q"),v=document.getElementById("seg-results"),p=document.getElementById("seg-count");let f;async function $(){const e=u.value.trim();if(!e){v.innerHTML="",p.textContent="";return}try{const a=await T.sessionTranscriptSearch(k,e,200);if(p.textContent=`${a.total} match${a.total===1?"":"es"}`,a.segments.length===0){v.innerHTML='<p class="empty" style="margin:0.5rem 0;">No matches in this session.</p>';return}const m=a.segments.slice().sort((c,_)=>Date.parse(c.timestamp)-Date.parse(_.timestamp));v.innerHTML=m.map(c=>`
              <div class="sd-seg-card">
                <div class="sd-seg-meta">
                  <span class="sd-role-pill role-${c.role}">${Q(c.role)}</span>
                  <span style="margin-left:0.5rem;">${S(c.timestamp)}</span>
                </div>
                <div class="sd-seg-snippet">${V(c.snippet)}</div>
              </div>
            `).join("")}catch{v.innerHTML='<p class="empty">Search failed.</p>'}}u.addEventListener("input",()=>{clearTimeout(f),f=setTimeout($,150)}),P&&(u.value=P,$())});const E=document.getElementById("content"),b=document.getElementById("timeline-content"),y=document.getElementById("subagents-content"),C=document.getElementById("tab-btn-overview"),M=document.getElementById("tab-btn-timeline"),H=document.getElementById("tab-btn-subagents");let j=!1,z=!1;C.addEventListener("click",()=>d("overview")),M.addEventListener("click",()=>d("timeline")),H.addEventListener("click",()=>d("subagents"));const D=t=>t.fresh_input_tokens+t.output_tokens;async function Z(){const t=await T.sessionTimeline(k);if(!t){b.innerHTML='<p class="empty">Timeline unavailable.</p>';return}if(t.turns.length===0){b.innerHTML='<p class="empty">No turns recorded for this session.</p>';return}const s=e=>`
            <div class="card tl-turn" data-fail="${e.tool_calls.some(a=>a.is_error===1)?1:0}" id="tl-turn-${e.sequence}" style="margin-bottom:0.6rem;">
              <div class="sd-turn-hdr">
                <span>#${e.sequence} · ${S(e.timestamp)} · <code>${o(e.model)}</code></span>
                <span><span class="tok">${L(D(e))} tok</span> <span style="color:var(--text-2);font-size:0.78rem;">· ${L(e.cache_read_tokens)} cache read</span> · <span class="cost">~${w(e.cost_usd)}</span></span>
              </div>
              ${e.tool_calls.length?e.tool_calls.map(a=>h(a,t.search_enabled)).join(""):'<div class="sd-no-tools">no tools — text reply</div>'}
            </div>`,r=150,n=t.turns.map(s);let i=Math.min(n.length,r);const g=t.turns.reduce((e,a)=>e+a.tool_calls.length,0),u=t.turns.reduce((e,a)=>e+a.tool_calls.filter(m=>m.is_error===1).length,0),v=t.turns.filter(e=>e.tool_calls.some(a=>a.is_error===1)).length;b.innerHTML=`
          <div style="display:flex;gap:1.4rem;flex-wrap:wrap;margin-bottom:0.8rem;font-size:0.88rem;color:var(--text-1);">
            <span><b>${l(t.turns.length)}</b> turns</span>
            <span><b>${l(g)}</b> tool calls</span>
            <span style="${u?"color:#f85149;":""}"><b>${l(u)}</b> failed${u?` <span style="color:var(--text-2);">across ${l(v)} turn${v===1?"":"s"}</span>`:""}</span>
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
          <div id="tl-feed">${n.slice(0,i).join("")}</div>
          ${n.length>r?`<button id="tl-more" type="button" style="width:100%;background:none;color:var(--text-2);border:1px dashed var(--border);border-radius:6px;padding:0.5rem;font:inherit;font-size:0.85rem;cursor:pointer;">Show remaining ${n.length-r} turns</button>`:""}
          <p id="tl-fail-empty" class="empty" style="display:none;">No failed tool calls in this session.</p>
        `;const p=document.getElementById("tl-fail-only");function f(){let e=0;b.querySelectorAll(".tl-turn").forEach(a=>{const m=!p.checked||a.dataset.fail==="1";a.style.display=m?"":"none",m&&e++}),document.getElementById("tl-fail-empty").style.display=e?"none":""}function $(){i>=n.length||(document.getElementById("tl-feed").insertAdjacentHTML("beforeend",n.slice(i).join("")),i=n.length,document.getElementById("tl-more")?.remove())}document.getElementById("tl-more")?.addEventListener("click",$),p.addEventListener("change",()=>{p.checked&&$(),f()}),U(document.getElementById("tl-chart"),t.turns.map(e=>({sequence:e.sequence,tokens:D(e),cacheRead:e.cache_read_tokens,hasError:e.tool_calls.some(a=>a.is_error===1)})),e=>{document.getElementById(`tl-turn-${e}`)||$(),document.getElementById(`tl-turn-${e}`)?.scrollIntoView({behavior:"smooth",block:"start"})}),b.addEventListener("click",async e=>{const a=e.target.closest(".tl-expandable");if(!a)return;const m=a.nextElementSibling;if(m&&m.classList.contains("sd-out-box")){m.remove();return}const c=document.createElement("div");c.className="sd-out-box",c.textContent="loading…",a.after(c);const _=await T.sessionToolOutput(k,a.dataset.tu);_?_.search_enabled?_.found?c.innerHTML=`<pre>${o(_.text)}</pre>`:c.textContent="output not indexed — it may have been empty, or restart argus to backfill":c.textContent="enable search indexing in Settings to see tool output":c.textContent="failed to load output"})}async function K(){y.innerHTML='<p class="empty">Loading sub-agents…</p>';let t=[];try{t=(await T.subagents(k)).subagents}catch{y.innerHTML='<p class="empty">Sub-agents unavailable.</p>';return}if(!t.length){y.innerHTML='<p class="empty">No sub-agents.</p>';return}const s=t.map((n,i)=>{const g=n.status==="error"?`${n.errors} failed tool call${n.errors===1?"":"s"}`:"no failed tool calls",u=n.status==="error"?`✗ ${l(n.errors)}`:"✓";return`
          <div class="sa-row${i===0?" sel":""}" data-i="${i}">
            <span class="sa-dot ${n.status}" title="${g}">${u}</span>
            <code class="mono">${o(n.model)}</code>
            <span class="sa-meta">${l(n.tool_calls)} tools · ${L(n.total_tokens)}</span>
          </div>`}).join("");y.innerHTML=`
          <div class="sa-wrap">
            <div class="sa-list">${s}</div>
            <div class="card sa-detail" id="sa-detail">${x(t[0])}</div>
          </div>`;const r=document.getElementById("sa-detail");y.querySelectorAll(".sa-row").forEach(n=>{n.addEventListener("click",()=>{y.querySelectorAll(".sa-row").forEach(i=>i.classList.remove("sel")),n.classList.add("sel"),r.innerHTML=x(t[Number(n.dataset.i)])})})}const N=document.getElementById("to-top");let q=!1;window.addEventListener("scroll",()=>{const t=window.scrollY>600;t!==q&&(q=t,N.style.display=t?"block":"none")},{passive:!0}),N.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
