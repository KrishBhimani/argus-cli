import{a as c,e as d,t as w,u as m,n as L,s as N,b as k}from"./format.DxC1NGYT.js";import{l as C,c as A,m as S}from"./charts.BIevw6Es.js";const j=3e4;async function v(n){const t=n.closest(".card");let a=[];try{a=(await c.alerts(20)).alerts}catch{t&&(t.style.display="none");return}if(a.length===0){t&&(t.style.display="none");return}t&&(t.style.display=""),n.innerHTML=`<ul class="alerts">${a.map(o=>`
    <li class="alert alert-${o.severity}">
      <div class="alert-head">
        <strong>${d(o.title)}</strong>
        <span class="alert-severity">${o.severity}</span>
      </div>
      <p>${d(o.message)}</p>
      <time>seen since ${new Date(o.first_seen_at).toLocaleString()}</time>
    </li>
  `).join("")}</ul>`}let _=!1;function E(){_||"Notification"in window&&Notification.permission==="default"&&(_=!0,document.addEventListener("click",()=>{Notification.permission==="default"&&Notification.requestPermission()},{once:!0}))}function M(n){E();const t=new Set;async function a(){try{const p=(await c.unseenAlerts("critical")).alerts.filter(i=>!t.has(i.id));let l=!1;for(const i of p){t.add(i.id),"Notification"in window&&Notification.permission==="granted"&&new Notification("Argus",{body:i.title,tag:`argus-alert-${i.id}`});try{await c.markAlertSeen(i.id)}catch{}l=!0}l&&await v(n)}catch{}}a(),setInterval(a,j)}const s=n=>document.querySelector(n),$=s("#window");let f,h,u;async function g(){const n=$.value,t=await c.overview(n);s(".hero-tokens").textContent=w(t.total_tokens),s("#hero-cost").textContent=m(t.total_cost_usd),s("#hero-sessions").textContent=L(t.session_count);const a=t.session_count?t.total_cost_usd/t.session_count:0;s("#hero-avg").textContent=t.session_count?`· ~${m(a)} est/session`:"";const o=Object.entries(t.cost_by_day).sort().map(([e,r])=>({day:e,cost:r}));f?.dispose(),o.length?f=C(s("#line"),o):s("#line").innerHTML='<p class="empty">No spend in this window.</p>';const p=n==="all"?t:await c.overview("all"),l=Object.entries(p.cost_by_day).sort().map(([e,r])=>({day:e,cost:r}));h?.dispose(),h=A(s("#heatmap"),l,90);const i=Object.entries(t.cost_by_model??{}).sort((e,r)=>r[1]-e[1]).map(([e,r])=>({name:e,cost:r}));u?.dispose(),i.length?u=S(s("#models"),i):s("#models").innerHTML='<p class="empty">No data.</p>';const y=(t.top_sessions??[]).slice(0,8);s("#recent").innerHTML=y.length?`
        <table>
          <thead><tr><th>Started</th><th>Project</th><th>Model</th><th class="num">Tokens <span class="est">(in window)</span></th><th class="num">Cost <span class="est">(in window)</span></th></tr></thead>
          <tbody>
            ${y.map(e=>`
              <tr data-id="${encodeURIComponent(e.id)}">
                <td>${N(e.started_at)}${e.days_active>1?` <span style="color:var(--text-2);font-size:0.75rem;">+${e.days_active-1}d</span>`:""}</td>
                <td class="mono">${d(k(e.project_path))}</td>
                <td><code>${d(e.primary_model)}</code></td>
                <td class="num tok">${w(e.window_tokens)}</td>
                <td class="num cost">~${m(e.window_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',s("#recent").querySelectorAll("tr[data-id]").forEach(e=>{e.addEventListener("click",()=>location.href="/session?id="+e.dataset.id)})}$.addEventListener("change",g);g();window.addEventListener("resize",()=>[f,h,u].forEach(n=>n?.resize()));const b=s("#alerts-body");v(b);M(b);
