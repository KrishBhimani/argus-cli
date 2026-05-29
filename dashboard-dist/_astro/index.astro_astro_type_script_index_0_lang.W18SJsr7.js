import{a as $,s as k,e as _,b as y,d as L,n as v,t as w,u as C}from"./format.DxC1NGYT.js";let l=[],c="started_at",a=!0;const u=e=>document.querySelector(e),h=u("#t tbody"),f=u("#search"),E=u("#count");function p(e){return e.total_fresh_input_tokens+e.total_output_tokens+e.total_cache_read_tokens+e.total_cache_write_tokens}function i(){const e=f.value.toLowerCase();let o=l.filter(t=>!e||t.id.toLowerCase().includes(e)||t.project_path.toLowerCase().includes(e)||t.primary_model.toLowerCase().includes(e));const s=(t,n)=>n==="tokens"?p(t):t[n];o.sort((t,n)=>{const r=s(t,c),d=s(n,c),m=r==null?-1:d==null?1:r<d?-1:r>d?1:0;return a?-m:m}),E.textContent=`${o.length} of ${l.length} sessions`,h.innerHTML=o.map(t=>`
        <tr data-id="${encodeURIComponent(t.id)}">
          <td>${k(t.started_at)}</td>
          <td class="mono">${_(y(t.project_path,50))}</td>
          <td><code>${_(t.primary_model)}</code></td>
          <td class="num">${L(t.duration_sec)}</td>
          <td class="num">${v(t.turn_count)}</td>
          <td class="num tok">${w(p(t))}</td>
          <td class="num cost">~${C(t.total_cost_usd)}</td>
        </tr>
      `).join("")||'<tr><td colspan="7" class="empty">No sessions match.</td></tr>',h.querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}document.querySelectorAll("th[data-sort]").forEach(e=>{e.addEventListener("click",()=>{const o=e.dataset.sort;o===c?a=!a:(c=o,a=!0),document.querySelectorAll("th[data-sort]").forEach(s=>s.className=s.classList.contains("num")?"num":""),e.className=(a?"sorted":"sorted-asc")+(e.classList.contains("num")?" num":""),i()})});f.addEventListener("input",i);$.sessions("?limit=10000").then(({sessions:e})=>{l=e,i()});
