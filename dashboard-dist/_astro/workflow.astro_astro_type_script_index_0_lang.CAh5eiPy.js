import{a as w,e,n as i,t as c,u as b}from"./format.ewPp6he2.js";import{r as I,a as x,p as f}from"./bloom.BDTUDwdd.js";const m=new URLSearchParams(location.search).get("id"),u=document.getElementById("wf-head"),E=document.getElementById("wf-spark"),L=document.getElementById("wf-bloom"),T=document.getElementById("wf-plan"),H=document.getElementById("wf-cost"),j=document.getElementById("wf-agent"),$=document.getElementById("wf-script-box"),h=t=>{const n=Math.round(t/1e3);return n<60?n+"s":n<3600?Math.floor(n/60)+"m "+n%60+"s":Math.floor(n/3600)+"h "+Math.floor(n%3600/60)+"m"};function C(t){const n=t.tools.length?t.tools.map(o=>`${e(o.name)} ${o.count}${o.errors?` <span class="bad">(${o.errors} err)</span>`:""}`).join(" &middot; "):'<span class="dim">no tool calls</span>',l=t.linked?`${c(t.total_tokens??0)} tokens &middot; ${b(t.cost_usd)} &middot; ${i(t.tool_calls)} tool calls &middot; ${i(t.errors)} err`:'<span class="dim">no session row — tokens and cost unavailable</span>',r=t.state!=="done"?` <span class="bad">&#10007; ${e(t.state)}</span>`:"";j.innerHTML=`
      <div class="wf-agent-head">
        <span class="wf-dot" style="background:${f(t.phase_index)}"></span>
        <strong>${e(t.label||t.agent_id)}</strong>${r}
        <span class="dim">${e(t.phase_title)} &middot; #${t.seq} &middot; ${e(t.model)}</span>
      </div>
      <p class="dim">queued ${h(t.queue_wait_ms)} &middot; ran ${h(t.duration_ms)}${t.linked?` &middot; ${i(t.turns??0)} turns`:""}${t.attempt>1?` &middot; &#8635; attempt ${t.attempt}`:""}</p>
      <p>${l}</p>
      <p>${n}</p>
      <h4>Prompt</h4>
      <pre class="wf-pre">${e(t.prompt_preview)||'<span class="dim">not available</span>'}</pre>
      <h4>Result</h4>
      <pre class="wf-pre">${e(t.result_preview)||'<span class="dim">not available</span>'}</pre>
      ${t.linked?`<a href="/session?id=${encodeURIComponent(t.sub_session_id)}">open full transcript &rarr;</a>`:""}`}(async()=>{if(!m){u.innerHTML='<p class="empty">No run id.</p>';return}const t=await w.workflow(m);if(!t){u.innerHTML='<p class="empty">Workflow run not found.</p>';return}const{run:n,agents:l}=t;u.innerHTML=`
      <h1 class="page-title">${e(n.name||n.run_id)}</h1>
      <p class="page-sub">${e(n.summary)}</p>
      <p class="dim"><code>${e(n.run_id)}</code> &middot;
         <a href="/session?id=${encodeURIComponent(n.session_id)}">in session &rarr;</a></p>
      <div class="wf-stats">
        <div><b>${i(n.agent_count)}</b><span>agents</span></div>
        <div><b>${h(n.duration_ms)}</b><span>wall clock</span></div>
        <div><b>${c(n.total_tokens)}</b><span>tokens</span></div>
        <div><b>${b(n.cost_usd)}</b><span>est. cost</span></div>
        <div><b>${i(n.tool_calls)}</b><span>tool calls</span></div>
        <div><b>${i(n.phase_count)}</b><span>phases</span></div>
        <div><b class="${n.error_agents?"bad":""}">${i(n.error_agents)}</b><span>failed</span></div>
      </div>`,I(E,l),x(L,l,C);const r=new Map;for(const s of l)r.set(s.phase_title,(r.get(s.phase_title)??0)+1);const o=n.phases.map(s=>s.title),g=new Set(o),_=[...r.keys()].filter(s=>s&&!g.has(s)),v=[...o,..._].map((s,a)=>{const B=r.get(s)??0;return`<span class="wf-chip"><span class="wf-dot" style="background:${f(a+1)}"></span><b>${e(s)}</b> ${B}${o.includes(s)?"":" &#9889;"}</span>`}).join("");T.innerHTML=`<h3>Plan vs actual</h3><div class="wf-chips">${v}</div>${n.logs.length?`<ul class="wf-logs">${n.logs.map(s=>`<li>${e(s)}</li>`).join("")}</ul>`:""}`;const d=s=>s.total_tokens??s.wf_tokens??0,p=new Map;for(const s of l){const a=p.get(s.phase_title)??{t:0,i:s.phase_index};a.t+=d(s),p.set(s.phase_title,a)}const k=Math.max(1,...[...p.values()].map(s=>s.t)),y=[...p.entries()].sort((s,a)=>a[1].t-s[1].t).map(([s,a])=>`<div class="wf-bar-row">
        <span>${e(s)}</span>
        <span class="wf-bar"><i style="width:${(a.t/k*100).toFixed(1)}%;background:${f(a.i)}"></i></span>
        <span class="num">${c(a.t)}</span></div>`).join(""),M=[...l].sort((s,a)=>d(a)-d(s)).slice(0,5).map(s=>`<div class="wf-bar-row"><span>${e(s.label||s.agent_id)}</span>
        <span></span><span class="num">${c(d(s))}</span></div>`).join("");H.innerHTML=`${y}<h4 style="margin-top:0.8rem;">Top consumers</h4>${M}`,n.has_script&&($.style.display="",$.addEventListener("toggle",async()=>{if(!$.open)return;const s=document.getElementById("wf-script");s.dataset.loaded||(s.textContent=await w.workflowScript(m)??"unavailable",s.dataset.loaded="1")},{once:!1}))})();
