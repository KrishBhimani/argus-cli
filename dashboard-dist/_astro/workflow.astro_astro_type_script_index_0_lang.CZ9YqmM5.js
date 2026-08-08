import{e as a,a as R,n as _,u as F,t as U}from"./format.ewPp6he2.js";const T=["#3987e5","#d95926","#199e70","#c98500","#d55181","#9085e9"],W="#6b7585";function S(s){const t=s-1;return t<0||t>=T.length?W:T[t]}const M=s=>{const t=Date.parse(s);return Number.isFinite(t)?t:NaN};function g(s){const t=M(s.started_at);return Number.isFinite(t)?t:M(s.queued_at)}function H(s){const t=g(s);if(!Number.isFinite(t))return NaN;if(s.duration_ms>0)return t+s.duration_ms;const r=M(s.last_progress_at);return Number.isFinite(r)?r:t}function V(s,t,r,o){const c=new Array(o).fill(0),m=Math.max(1,r-t);for(const b of s){const u=g(b),f=H(b);if(!Number.isFinite(u)||!Number.isFinite(f))continue;const k=Math.max(0,Math.floor((u-t)/m*o)),w=Math.min(o-1,Math.floor((f-t)/m*o));for(let h=k;h<=w;h++)c[h]+=1}return c}function z(s){const t=Math.max(1,...s),r=s.length,o=s.map((c,m)=>`${(m/(r-1)*100).toFixed(3)},${(100-c/t*100).toFixed(2)}`).join(" ");return`<svg class="wf-ribbon-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="0,100 ${o} 100,100" fill="var(--accent-dim)"></polygon>
    <polyline points="${o}" fill="none" stroke="var(--accent)" stroke-width="0.6"
      vector-effect="non-scaling-stroke"></polyline>
  </svg>`}function B(s){if(!Number.isFinite(s)||s<=0)return"0s";const t=Math.round(s/1e3);return t<60?`${t}s`:t<3600?`${Math.floor(t/60)}m ${t%60}s`:`${Math.floor(t/3600)}h ${Math.floor(t%3600/60)}m`}function G(s){const t=[`<strong>${a(s.label||s.agent_id)}</strong>`,`${a(s.phase_title)} &middot; ${a(s.model)}`,`ran ${B(s.duration_ms)}${s.queue_wait_ms>0?` &middot; queued ${B(s.queue_wait_ms)}`:""}`];return s.linked?t.push(`${s.tool_calls} tool calls &middot; ${s.errors} errors`):t.push("<em>not linked to a session row</em>"),s.last_tool_name&&t.push(`last: ${a(s.last_tool_name)}`),s.attempt>1&&t.push(`attempt ${s.attempt}`),s.fallback_model&&t.push(`fell back to ${a(s.fallback_model)}`),t.join("<br>")}function J(s,t,r){const o=t.filter(n=>Number.isFinite(g(n)));if(!o.length){s.innerHTML='<p class="empty">No agent timings recorded for this run.</p>';return}const c=Math.min(...o.map(n=>Math.min(g(n),M(n.queued_at)||1/0))),m=Math.max(...o.map(n=>H(n))),b=Math.max(1,m-c),u=n=>(n-c)/b*100,f=V(o,c,m,240),k=Math.max(...f),w=new Map;for(const n of o)w.has(n.phase_index)||w.set(n.phase_index,[]),w.get(n.phase_index).push(n);const h=[...w.entries()].sort((n,i)=>n[0]-i[0]);for(const[,n]of h)n.sort((i,d)=>g(i)-g(d));const e=new Map(o.map(n=>[n.agent_id,n])),l=h.map(([n,i])=>{const d=S(n),$=i.map(p=>{const x=g(p),A=H(p),L=M(p.queued_at),O=Number.isFinite(L)&&x-L>0?`<span class="wf-seg wf-seg-queue" style="left:${u(L).toFixed(3)}%;width:${(u(x)-u(L)).toFixed(3)}%"></span>`:"",P=p.state==="done"?"wf-row":"wf-row wf-row-err",D=[p.attempt>1?'<span class="wf-mark" title="retried">&#8635;</span>':"",p.fallback_model?'<span class="wf-mark" title="model fallback">&#9660;</span>':"",p.state!=="done"?'<span class="wf-mark wf-mark-err">&#10007;</span>':""].join("");return`<button type="button" class="${P}" data-agent="${a(p.agent_id)}">
        <span class="wf-row-label" title="${a(p.label||p.agent_id)}">${a(p.label||p.agent_id)}</span>
        <span class="wf-row-track">
          ${O}
          <span class="wf-seg wf-seg-run" style="left:${u(x).toFixed(3)}%;width:${Math.max(0,u(A)-u(x)).toFixed(3)}%;background:${d}"></span>
        </span>
        <span class="wf-row-marks">${D}</span>
      </button>`}).join("");return`<div class="wf-band">
      <div class="wf-band-head">
        <span class="wf-band-dot" style="background:${d}"></span>
        <span class="wf-band-name">${a(i[0].phase_title||`Phase ${n}`)}</span>
        <span class="wf-band-count">${i.length}</span>
      </div>
      ${$}
    </div>`}).join(""),C=[0,.25,.5,.75,1].map(n=>`<span style="left:${(n*100).toFixed(0)}%">${B(b*n)}</span>`).join("");s.innerHTML=`
    <div class="wf-ribbon">
      <span class="wf-ribbon-label">concurrency &middot; peak ${k}</span>
      ${z(f)}
    </div>
    <div class="wf-lanes">${l}</div>
    <div class="wf-axis">${C}</div>
    <div class="wf-tip" id="wf-tip" role="tooltip" hidden></div>`;const v=s.querySelector("#wf-tip"),y=[...s.querySelectorAll(".wf-row")],I=n=>{const i=e.get(n.dataset.agent);if(!i)return;v.innerHTML=G(i),v.hidden=!1;const d=n.getBoundingClientRect(),$=s.getBoundingClientRect();v.style.top=`${d.bottom-$.top+6}px`,v.style.left=`${Math.min(d.left-$.left+120,$.width-260)}px`};for(const n of y)n.addEventListener("mouseenter",()=>I(n)),n.addEventListener("focus",()=>I(n)),n.addEventListener("mouseleave",()=>{v.hidden=!0}),n.addEventListener("blur",()=>{v.hidden=!0}),n.addEventListener("click",()=>{for(const d of y)d.classList.remove("sel");n.classList.add("sel");const i=e.get(n.dataset.agent);i&&r(i)}),n.addEventListener("keydown",i=>{if(i.key!=="ArrowDown"&&i.key!=="ArrowUp")return;i.preventDefault();const d=y.indexOf(n),$=y[i.key==="ArrowDown"?d+1:d-1];$&&$.focus()});y.length&&y[0].click()}const E=new URLSearchParams(location.search).get("id"),N=document.getElementById("wf-head"),K=document.getElementById("wf-plan"),Q=document.getElementById("wf-swim"),X=document.getElementById("wf-cost"),Y=document.getElementById("wf-agent"),q=document.getElementById("wf-script-box"),j=s=>{const t=Math.round(s/1e3);return t<60?t+"s":t<3600?Math.floor(t/60)+"m "+t%60+"s":Math.floor(t/3600)+"h "+Math.floor(t%3600/60)+"m"};function Z(s){const t=s.tools.length?s.tools.map(o=>`${a(o.name)} ${o.count}${o.errors?` <span class="bad">(${o.errors} err)</span>`:""}`).join(" &middot; "):'<span class="dim">no tool calls</span>',r=s.linked?`${U(s.total_tokens??0)} tokens &middot; ${F(s.cost_usd)} &middot; ${_(s.tool_calls)} tool calls &middot; ${_(s.errors)} err`:'<span class="dim">no session row — tokens and cost unavailable</span>';Y.innerHTML=`
      <div class="wf-agent-head">
        <span class="wf-band-dot" style="background:${S(s.phase_index)}"></span>
        <strong>${a(s.label||s.agent_id)}</strong>
        <span class="dim">${a(s.phase_title)} &middot; #${s.seq} &middot; ${a(s.model)}</span>
      </div>
      <p class="dim">queued ${j(s.queue_wait_ms)} &middot; ran ${j(s.duration_ms)}${s.linked?` &middot; ${_(s.turns??0)} turns`:""}</p>
      <p>${r}</p>
      <p>${t}</p>
      <h4>Prompt</h4>
      <pre class="wf-pre">${a(s.prompt_preview)||'<span class="dim">not available</span>'}</pre>
      <h4>Result</h4>
      <pre class="wf-pre">${a(s.result_preview)||'<span class="dim">not available</span>'}</pre>
      ${s.linked?`<a href="/session?id=${encodeURIComponent(s.sub_session_id)}">open full transcript &rarr;</a>`:""}`}(async()=>{if(!E){N.innerHTML='<p class="empty">No run id.</p>';return}const s=await R.workflow(E);if(!s){N.innerHTML='<p class="empty">Workflow run not found.</p>';return}const{run:t,agents:r}=s;N.innerHTML=`
      <h1 class="page-title">${a(t.name||t.run_id)}</h1>
      <p class="page-sub">${a(t.summary)}</p>
      <p class="dim"><code>${a(t.run_id)}</code> &middot;
         <a href="/session?id=${encodeURIComponent(t.session_id)}">in session &rarr;</a></p>
      <div class="wf-stats">
        <div><b>${_(t.agent_count)}</b><span>agents</span></div>
        <div><b>${j(t.duration_ms)}</b><span>wall clock</span></div>
        <div><b>${F(t.cost_usd)}</b><span>est. cost</span></div>
        <div><b>${_(t.tool_calls)}</b><span>tool calls</span></div>
        <div><b>${_(t.phase_count)}</b><span>phases</span></div>
        <div><b class="${t.error_agents?"bad":""}">${_(t.error_agents)}</b><span>failed</span></div>
      </div>`;const o=new Map;for(const e of r)o.set(e.phase_title,(o.get(e.phase_title)??0)+1);const c=t.phases.map(e=>e.title),m=new Set(c),b=[...o.keys()].filter(e=>e&&!m.has(e)),u=[...c,...b].map(e=>{const l=o.get(e)??0;return`<span class="wf-chip"><b>${a(e)}</b> ${l}${c.includes(e)?"":" &#9889;"}</span>`}).join("");K.innerHTML=`<h3>Plan vs actual</h3><div class="wf-chips">${u}</div>${t.logs.length?`<ul class="wf-logs">${t.logs.map(e=>`<li>${a(e)}</li>`).join("")}</ul>`:""}`,J(Q,r,Z);const f=new Map;for(const e of r){const l=f.get(e.phase_title)??{c:0,i:e.phase_index};l.c+=e.cost_usd??0,f.set(e.phase_title,l)}const k=Math.max(1e-4,...[...f.values()].map(e=>e.c)),w=[...f.entries()].sort((e,l)=>l[1].c-e[1].c).map(([e,l])=>`<div class="wf-bar-row">
        <span>${a(e)}</span>
        <span class="wf-bar"><i style="width:${(l.c/k*100).toFixed(1)}%;background:${S(l.i)}"></i></span>
        <span class="num">${F(l.c)}</span></div>`).join(""),h=[...r].filter(e=>e.cost_usd!=null).sort((e,l)=>(l.cost_usd??0)-(e.cost_usd??0)).slice(0,5).map(e=>`<div class="wf-bar-row"><span>${a(e.label||e.agent_id)}</span>
        <span></span><span class="num">${F(e.cost_usd)}</span></div>`).join("");X.innerHTML=`<h3>Where the money went</h3>${w}
      <h4>Top spend</h4>${h||'<p class="dim">no linked sessions</p>'}`,t.has_script&&(q.style.display="",q.addEventListener("toggle",async()=>{if(!q.open)return;const e=document.getElementById("wf-script");e.dataset.loaded||(e.textContent=await R.workflowScript(E)??"unavailable",e.dataset.loaded="1")},{once:!1}))})();
