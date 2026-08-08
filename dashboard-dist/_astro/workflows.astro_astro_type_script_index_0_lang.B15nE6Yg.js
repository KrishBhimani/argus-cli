import{a as o,e as a,n as e,s as r,t as d,u as l}from"./format.ewPp6he2.js";const h=s=>{const t=Math.round(s/1e3);return t<60?t+"s":t<3600?Math.floor(t/60)+"m "+t%60+"s":Math.floor(t/3600)+"h "+Math.floor(t%3600/60)+"m"},n=document.getElementById("wf-list");(async()=>{let s;try{s=(await o.workflows()).workflows}catch{n.innerHTML='<p class="empty">Workflows unavailable.</p>';return}if(!s.length){n.innerHTML=`
        <div class="card">
          <h2>No workflow runs archived yet</h2>
          <p>A <strong>workflow</strong> is a script that orchestrates many sub-agents
             at once — fanning work out across phases, then verifying the results.</p>
          <p>Claude Code writes a run record for each one and deletes it a few days
             later. Argus now archives those records as they appear, so runs from
             here on will show up on this page with their phases, per-agent prompts,
             timings and cost.</p>
        </div>`;return}n.innerHTML=`
      <div class="card" style="padding:0;overflow:auto;">
      <table>
        <thead><tr>
          <th>Workflow</th><th>Status</th><th>Started</th>
          <th class="num">Agents</th><th class="num">Duration</th>
          <th class="num">Tools</th><th class="num">Tokens</th><th class="num">Cost</th>
        </tr></thead>
        <tbody>${s.map(t=>`
          <tr>
            <td>
              <a href="/workflow?id=${encodeURIComponent(t.run_id)}">${a(t.name||t.run_id)}</a>
              <div class="dim">${a(t.summary)}</div>
            </td>
            <td>${t.error_agents>0?`<span class="tag tag-bad">${e(t.error_agents)} failed</span>`:`<span class="tag">${a(t.status)}</span>`}</td>
            <td>${a(r(t.started_at))}</td>
            <td class="num">${e(t.agent_count)}</td>
            <td class="num">${h(t.duration_ms)}</td>
            <td class="num">${e(t.tool_calls)}</td>
            <td class="num">${d(t.total_tokens)}</td>
            <td class="num">${l(t.cost_usd)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      </div>`})();
