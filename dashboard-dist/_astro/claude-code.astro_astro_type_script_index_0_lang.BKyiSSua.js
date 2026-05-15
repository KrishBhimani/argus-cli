import{n as s}from"./format.BCwVRjzP.js";const a=document.getElementById("cc-window"),o=document.getElementById("cc-subagents"),r=document.getElementById("cc-summary");function u(e){return String(e).replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[n])}async function c(){const e=a.value,n=await fetch("/api/agents/claude-code/sub-agents?window="+e).then(t=>t.json());!n.sub_agents||n.sub_agents.length===0?o.innerHTML='<tr><td colspan="4" class="muted">No sub-agent invocations in this window.</td></tr>':o.innerHTML=n.sub_agents.map(t=>`
          <tr>
            <td>${u(t.type)}</td>
            <td class="num">${s(t.invocations)}</td>
            <td class="num">${s(t.errors)}</td>
            <td class="num">${(t.error_rate*100).toFixed(1)}%</td>
          </tr>`).join("");const d=(n.sub_agents??[]).reduce((t,i)=>t+i.invocations,0);r.textContent=`Last ${e} · ${s(d)} sub-agent invocations`}a.addEventListener("change",c);c();
