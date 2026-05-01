import{a as p}from"./api.DTjsyKW_.js";import{u as n,t as u,n as e,d as m,a as h}from"./format.BUtUhAI5.js";const c=new URLSearchParams(location.search).get("id"),d=document.getElementById("content");c?p.session(c).then(l=>{if(!l){d.innerHTML='<p class="empty">Session not found.</p>';return}const{session:t,turns:a}=l,r=t.total_fresh_input_tokens+t.total_output_tokens+t.total_cache_read_tokens+t.total_cache_write_tokens,o=t.metadata?.sub_agent_session_ids,i=t.agent_reported_cost_usd!=null?`<span style="color:var(--text-2);font-size:0.8rem;"> (agent reported: ${n(t.agent_reported_cost_usd)})</span>`:"";d.innerHTML=`
          <div class="grid-cards" style="margin-bottom:1.2rem;">
            <div class="card kpi"><span class="kpi-label">Cost</span><span class="kpi-value cost">${n(t.total_cost_usd)}</span><span class="kpi-sub">${i}</span></div>
            <div class="card kpi"><span class="kpi-label">Tokens</span><span class="kpi-value">${u(r)}</span><span class="kpi-sub">${e(r)} total</span></div>
            <div class="card kpi"><span class="kpi-label">Turns</span><span class="kpi-value">${e(t.turn_count)}</span><span class="kpi-sub">${a.length} loaded</span></div>
            <div class="card kpi"><span class="kpi-label">Duration</span><span class="kpi-value">${m(t.duration_sec)}</span><span class="kpi-sub">${t.started_at.replace("T"," ").slice(0,19)}</span></div>
          </div>

          <div class="card" style="margin-bottom:1rem;">
            <h3>Session</h3>
            <table style="border:none;">
              <tbody>
                <tr><td style="width:25%;color:var(--text-2);">Agent</td><td>${h(t.agent)} <code>${t.agent_version??""}</code></td></tr>
                <tr><td style="color:var(--text-2);">Project</td><td class="mono">${t.project_path||"—"}</td></tr>
                <tr><td style="color:var(--text-2);">Primary model</td><td><code>${t.primary_model}</code></td></tr>
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
            <h3>Turns timeline</h3>
            ${a.length?`
            <table>
              <thead>
                <tr>
                  <th class="num">#</th><th>Time</th><th>Model</th>
                  <th class="num">Fresh in</th><th class="num">Cache read</th><th class="num">Cache write</th>
                  <th class="num">Output</th><th class="num">Tools</th><th class="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                ${a.map(s=>`
                  <tr>
                    <td class="num">${s.sequence}</td>
                    <td>${s.timestamp.slice(11,19)}</td>
                    <td><code>${s.model}</code></td>
                    <td class="num">${e(s.fresh_input_tokens)}</td>
                    <td class="num">${e(s.cache_read_tokens)}</td>
                    <td class="num">${e(s.cache_write_tokens)}</td>
                    <td class="num">${e(s.output_tokens)}</td>
                    <td class="num">${s.tool_calls_count}</td>
                    <td class="num cost">${n(s.cost_usd)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>`:'<p class="empty">No turns recorded for this session.</p>'}
          </div>
        `}):d.innerHTML='<p class="empty">No session id.</p>';
