import{a as L}from"./api.DTjsyKW_.js";import{s as g,a as y,b as k,d as v,n as E,t as w,u as C}from"./format.BUtUhAI5.js";let u=[],r="started_at",a=!0;const c=e=>document.querySelector(e),h=c("#t tbody"),f=c("#search"),$=c("#agent-filter"),q=c("#count");function p(e){return e.total_fresh_input_tokens+e.total_output_tokens+e.total_cache_read_tokens+e.total_cache_write_tokens}function d(){const e=f.value.toLowerCase(),s=$.value;let o=u.filter(t=>(!s||t.agent===s)&&(!e||t.id.toLowerCase().includes(e)||t.project_path.toLowerCase().includes(e)||t.primary_model.toLowerCase().includes(e)));const m=(t,n)=>n==="tokens"?p(t):t[n];o.sort((t,n)=>{const l=m(t,r),i=m(n,r),_=l==null?-1:i==null?1:l<i?-1:l>i?1:0;return a?-_:_}),q.textContent=`${o.length} of ${u.length} sessions`,h.innerHTML=o.map(t=>`
        <tr data-id="${encodeURIComponent(t.id)}">
          <td>${g(t.started_at)}</td>
          <td>${y(t.agent)}</td>
          <td class="mono">${k(t.project_path,50)}</td>
          <td>${t.primary_model}</td>
          <td class="num">${v(t.duration_sec)}</td>
          <td class="num">${E(t.turn_count)}</td>
          <td class="num">${w(p(t))}</td>
          <td class="num cost">${C(t.total_cost_usd)}</td>
        </tr>
      `).join("")||'<tr><td colspan="8" class="empty">No sessions match.</td></tr>',h.querySelectorAll("tr[data-id]").forEach(t=>{t.addEventListener("click",()=>location.href="/session?id="+t.dataset.id)})}document.querySelectorAll("th[data-sort]").forEach(e=>{e.addEventListener("click",()=>{const s=e.dataset.sort;s===r?a=!a:(r=s,a=!0),document.querySelectorAll("th[data-sort]").forEach(o=>o.className=o.classList.contains("num")?"num":""),e.className=(a?"sorted":"sorted-asc")+(e.classList.contains("num")?" num":""),d()})});f.addEventListener("input",d);$.addEventListener("change",d);L.sessions("?limit=10000").then(({sessions:e})=>{u=e,d()});
