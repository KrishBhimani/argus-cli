import{a as h,e,n as l,t as w,u as p}from"./format.ewPp6he2.js";import{r as B,a as I,p as $}from"./bloom.BDTUDwdd.js";const c=new URLSearchParams(location.search).get("id"),m=document.getElementById("wf-head"),x=document.getElementById("wf-spark"),E=document.getElementById("wf-bloom"),L=document.getElementById("wf-plan"),H=document.getElementById("wf-cost"),T=document.getElementById("wf-agent"),u=document.getElementById("wf-script-box"),f=n=>{const t=Math.round(n/1e3);return t<60?t+"s":t<3600?Math.floor(t/60)+"m "+t%60+"s":Math.floor(t/3600)+"h "+Math.floor(t%3600/60)+"m"};function C(n){const t=n.tools.length?n.tools.map(o=>`${e(o.name)} ${o.count}${o.errors?` <span class="bad">(${o.errors} err)</span>`:""}`).join(" &middot; "):'<span class="dim">no tool calls</span>',d=n.linked?`${w(n.total_tokens??0)} tokens &middot; ${p(n.cost_usd)} &middot; ${l(n.tool_calls)} tool calls &middot; ${l(n.errors)} err`:'<span class="dim">no session row — tokens and cost unavailable</span>',i=n.state!=="done"?` <span class="bad">&#10007; ${e(n.state)}</span>`:"";T.innerHTML=`
      <div class="wf-agent-head">
        <span class="wf-dot" style="background:${$(n.phase_index)}"></span>
        <strong>${e(n.label||n.agent_id)}</strong>${i}
        <span class="dim">${e(n.phase_title)} &middot; #${n.seq} &middot; ${e(n.model)}</span>
      </div>
      <p class="dim">queued ${f(n.queue_wait_ms)} &middot; ran ${f(n.duration_ms)}${n.linked?` &middot; ${l(n.turns??0)} turns`:""}${n.attempt>1?` &middot; &#8635; attempt ${n.attempt}`:""}</p>
      <p>${d}</p>
      <p>${t}</p>
      <h4>Prompt</h4>
      <pre class="wf-pre">${e(n.prompt_preview)||'<span class="dim">not available</span>'}</pre>
      <h4>Result</h4>
      <pre class="wf-pre">${e(n.result_preview)||'<span class="dim">not available</span>'}</pre>
      ${n.linked?`<a href="/session?id=${encodeURIComponent(n.sub_session_id)}">open full transcript &rarr;</a>`:""}`}(async()=>{if(!c){m.innerHTML='<p class="empty">No run id.</p>';return}const n=await h.workflow(c);if(!n){m.innerHTML='<p class="empty">Workflow run not found.</p>';return}const{run:t,agents:d}=n;m.innerHTML=`
      <h1 class="page-title">${e(t.name||t.run_id)}</h1>
      <p class="page-sub">${e(t.summary)}</p>
      <p class="dim"><code>${e(t.run_id)}</code> &middot;
         <a href="/session?id=${encodeURIComponent(t.session_id)}">in session &rarr;</a></p>
      <div class="wf-stats">
        <div><b>${l(t.agent_count)}</b><span>agents</span></div>
        <div><b>${f(t.duration_ms)}</b><span>wall clock</span></div>
        <div><b>${w(t.total_tokens)}</b><span>tokens</span></div>
        <div><b>${p(t.cost_usd)}</b><span>est. cost</span></div>
        <div><b>${l(t.tool_calls)}</b><span>tool calls</span></div>
        <div><b>${l(t.phase_count)}</b><span>phases</span></div>
        <div><b class="${t.error_agents?"bad":""}">${l(t.error_agents)}</b><span>failed</span></div>
      </div>`,B(x,d),I(E,d,C);const i=new Map;for(const s of d)i.set(s.phase_title,(i.get(s.phase_title)??0)+1);const o=t.phases.map(s=>s.title),b=new Set(o),g=[...i.keys()].filter(s=>s&&!b.has(s)),_=[...o,...g].map((s,a)=>{const M=i.get(s)??0;return`<span class="wf-chip"><span class="wf-dot" style="background:${$(a+1)}"></span><b>${e(s)}</b> ${M}${o.includes(s)?"":" &#9889;"}</span>`}).join("");L.innerHTML=`<h3>Plan vs actual</h3><div class="wf-chips">${_}</div>${t.logs.length?`<ul class="wf-logs">${t.logs.map(s=>`<li>${e(s)}</li>`).join("")}</ul>`:""}`;const r=new Map;for(const s of d){const a=r.get(s.phase_title)??{c:0,i:s.phase_index};a.c+=s.cost_usd??0,r.set(s.phase_title,a)}const v=Math.max(1e-4,...[...r.values()].map(s=>s.c)),y=[...r.entries()].sort((s,a)=>a[1].c-s[1].c).map(([s,a])=>`<div class="wf-bar-row">
        <span>${e(s)}</span>
        <span class="wf-bar"><i style="width:${(a.c/v*100).toFixed(1)}%;background:${$(a.i)}"></i></span>
        <span class="num">${p(a.c)}</span></div>`).join(""),k=[...d].filter(s=>s.cost_usd!=null).sort((s,a)=>(a.cost_usd??0)-(s.cost_usd??0)).slice(0,5).map(s=>`<div class="wf-bar-row"><span>${e(s.label||s.agent_id)}</span>
        <span></span><span class="num">${p(s.cost_usd)}</span></div>`).join("");H.innerHTML=`${y}<h4 style="margin-top:0.8rem;">Top spend</h4>${k||'<p class="dim">no linked sessions</p>'}`,t.has_script&&(u.style.display="",u.addEventListener("toggle",async()=>{if(!u.open)return;const s=document.getElementById("wf-script");s.dataset.loaded||(s.textContent=await h.workflowScript(c)??"unavailable",s.dataset.loaded="1")},{once:!1}))})();
