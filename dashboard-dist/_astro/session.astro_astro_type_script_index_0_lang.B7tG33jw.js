import{a as h}from"./api.DTjsyKW_.js";import{u as r,t as _,n as e,d as v,a as $}from"./format.BUtUhAI5.js";const c=Intl.DateTimeFormat().resolvedOptions().timeZone,p=(()=>{const t=new Date().toLocaleTimeString("en-US",{timeZoneName:"short"}).match(/[A-Z]{2,5}$/);return t?t[0]:""})(),d=a=>a?new Date(a).toLocaleString([],{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",g=a=>a?new Date(a).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}):"—",m=new URLSearchParams(location.search).get("id"),l=document.getElementById("content");m?h.session(m).then(a=>{if(!a){l.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:n}=a,i=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,o=t.metadata?.sub_agent_session_ids,u=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${r(t.agent_reported_cost_usd)})</span>`:"";l.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Cost</span><span class="kpi-value cost">${r(t.total_cost_usd)}</span><span class="kpi-sub">${u}</span></div>
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value">${_(i)}</span><span class="kpi-sub">${e(i)} total</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${e(t.turn_count)}</span><span class="kpi-sub">${n.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${v(t.duration_sec)}</span><span class="kpi-sub">started ${d(t.started_at)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Agent</td><td>${$(t.agent)} <code>${t.agent_version??""}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${t.project_path||"—"}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${t.primary_model}</code></td></tr>
                <tr><td style="color:var(--text-2);">Started</td><td>${d(t.started_at)} <span style="color:var(--text-2);font-size:0.8rem;">${p} (${c})</span></td></tr>
                <tr><td style="color:var(--text-2);">Ended</td><td>${t.ended_at?d(t.ended_at):'<span style="color:var(--text-2);">— still active</span>'}</td></tr>
                <tr><td style="color:var(--text-2);">Fresh input</td><td>${e(t.total_fresh_input_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Output</td><td>${e(t.total_output_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache writes</td><td>${e(t.total_cache_write_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Cache reads</td><td>${e(t.total_cache_read_tokens)} tokens</td></tr>
                <tr><td style="color:var(--text-2);">Pricing version</td><td><code>${t.pricing_table_version}</code></td></tr>
                <tr><td style="color:var(--text-2);">Session id</td><td class="mono" style="word-break:break-all;">${t.id}</td></tr>
              </tbody>
            </table>
          </div>

          ${o?.length?`
          <div class="card" style="margin-bottom:1rem;">
            <h3>Sub-agents (${o.length})</h3>
            <ul style="margin:0;padding-left:1.2rem;color:var(--text-1);font-size:0.88rem;">
              ${o.map(s=>`<li><a href="/session?id=${encodeURIComponent(s)}" class="mono">${s}</a></li>`).join("")}
            </ul>
          </div>`:""}

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <h3 style="margin:0;">Turns timeline</h3>
              <span style="color:var(--text-2);font-size:0.75rem;">times in ${p} (${c})</span>
            </div>
            ${n.length?`
            <table style="margin-top:0.8rem;">
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                ${n.map(s=>`
                  <tr>
                    <td class="num">${s.sequence}</td>
                    <td>${g(s.timestamp)}</td>
                    <td><code>${s.model}</code></td>
                    <td class="num">${e(s.fresh_input_tokens)}</td>
                    <td class="num">${e(s.cache_read_tokens)}</td>
                    <td class="num">${e(s.cache_write_tokens)}</td>
                    <td class="num">${e(s.output_tokens)}</td>
                    <td class="num">${s.tool_calls_count}</td>
                    <td class="num cost">${r(s.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `}):l.innerHTML='<p class="empty">No session id.</p>';
