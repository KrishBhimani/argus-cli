import{n as o,t as a,u as c,a as v}from"./format.BCwVRjzP.js";const l=document.getElementById("oc-window"),r=document.getElementById("oc-named-agents"),m=document.getElementById("oc-providers"),_=document.getElementById("oc-summary");function i(n){return String(n).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}async function u(){const n=l.value,[e,d]=await Promise.all([fetch("/api/agents/openclaw/named-agents?window="+n).then(t=>t.json()),fetch("/api/agents/openclaw/providers?window="+n).then(t=>t.json())]);!e.named_agents||e.named_agents.length===0?r.innerHTML='<tr><td colspan="5" class="muted">No OpenClaw activity in this window.</td></tr>':r.innerHTML=e.named_agents.map(t=>`
          <tr>
            <td><a href="/sessions?agent=openclaw&backend_agent=${encodeURIComponent(t.name)}">${i(t.name)}</a></td>
            <td class="num">${o(t.sessions)}</td>
            <td class="num">${a(t.tokens)}</td>
            <td class="num">${c(t.cost_usd)}</td>
            <td>${t.last_active?v(t.last_active):"—"}</td>
          </tr>`).join(""),!d.providers||d.providers.length===0?m.innerHTML='<tr><td colspan="5" class="muted">No provider data in this window.</td></tr>':m.innerHTML=d.providers.map(t=>`
          <tr>
            <td>${i(t.provider)}</td>
            <td class="num">${o(t.models)}</td>
            <td class="num">${o(t.sessions)}</td>
            <td class="num">${a(t.tokens)}</td>
            <td class="num">${c(t.cost_usd)}</td>
          </tr>`).join("");const g=(e.named_agents??[]).reduce((t,s)=>t+s.sessions,0),p=(e.named_agents??[]).reduce((t,s)=>t+s.tokens,0),w=(e.named_agents??[]).reduce((t,s)=>t+s.cost_usd,0),$=(e.named_agents??[]).length;_.textContent=`Last ${n} · ${$} named agents · ${o(g)} sessions · ${a(p)} tokens · ${c(w)} reported`}l.addEventListener("change",u);u();
