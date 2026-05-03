import{a as f}from"./api.B63xdRaj.js";import{s as $,b as k,d as y,n as L,t as v,u as w}from"./format.DZCscyiN.js";let l=[],r="started_at",n=!0;const u=e=>document.querySelector(e),_=u("#t tbody"),p=u("#search"),C=u("#count");function h(e){return e.total_fresh_input_tokens+e.total_output_tokens+e.total_cache_read_tokens+e.total_cache_write_tokens}function i(){const e=p.value.toLowerCase();let o=l.filter(t=>!e||t.id.toLowerCase().includes(e)||t.project_path.toLowerCase().includes(e)||t.primary_model.toLowerCase().includes(e));const s=(t,a)=>a==="tokens"?h(t):t[a];o.sort((t,a)=>{const c=s(t,r),d=s(a,r),m=c==null?-1:d==null?1:c<d?-1:c>d?1:0;return n?-m:m}),C.textContent=`${o.length} of ${l.length} sessions`,_.innerHTML=o.map(t=>`
        <tr data-id="${encodeURIComponent(t.id)}">
          <td>${$(t.started_at)}</td>
          <td class="mono">${k(t.project_path,50)}</td>
          <td><code>${t.primary_model}</code></td>
          <td class="num">${y(t.duration_sec)}</td>
          <td class="num">${L(t.turn_count)}</td>
          <td class="num tok">${v(h(t))}</td>
          <td class="num cost">~${w(t.total_cost_usd)}</td>
        </tr>
      `).join("")||'<tr><td colspan="7" class="empty">No sessions match.</td></tr>',_.querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}document.querySelectorAll("th[data-sort]").forEach(e=>{e.addEventListener("click",()=>{const o=e.dataset.sort;o===r?n=!n:(r=o,n=!0),document.querySelectorAll("th[data-sort]").forEach(s=>s.className=s.classList.contains("num")?"num":""),e.className=(n?"sorted":"sorted-asc")+(e.classList.contains("num")?" num":""),i()})});p.addEventListener("input",i);f.sessions("?limit=10000").then(({sessions:e})=>{l=e,i()});
