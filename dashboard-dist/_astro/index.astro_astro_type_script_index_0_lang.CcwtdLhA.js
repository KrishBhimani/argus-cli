import{a as c,e as d,t as p,u as w,n as b,s as L,b as N}from"./format.CgLh3UFa.js";import{l as C,c as A,m as M}from"./charts.CrWnno0Z.js";const S=3e4;async function v(n){const t=n.closest(".card");let a=[];try{a=(await c.alerts(20)).alerts}catch{t&&(t.style.display="none");return}if(a.length===0){t&&(t.style.display="none");return}t&&(t.style.display=""),n.innerHTML=`<ul class="alerts">${a.map(o=>`
    <li class="alert alert-${o.severity}">
      <div class="alert-head">
        <strong>${d(o.title)}</strong>
        <span class="alert-severity">${o.severity}</span>
      </div>
      <p>${d(o.message)}</p>
      <time>seen since ${new Date(o.first_seen_at).toLocaleString()}</time>
    </li>
  `).join("")}</ul>`}let _=!1;function T(){_||"Notification"in window&&Notification.permission==="default"&&(_=!0,document.addEventListener("click",()=>{Notification.permission==="default"&&Notification.requestPermission()},{once:!0}))}function j(n){T();const t=new Set;async function a(){try{const m=(await c.unseenAlerts("critical")).alerts.filter(i=>!t.has(i.id));let l=!1;for(const i of m){t.add(i.id),"Notification"in window&&Notification.permission==="granted"&&new Notification("Argus",{body:i.title,tag:`argus-alert-${i.id}`});try{await c.markAlertSeen(i.id)}catch{}l=!0}l&&await v(n)}catch{}}a(),setInterval(a,S)}const s=n=>document.querySelector(n),k=s("#window");let f,h,u;async function $(){const n=k.value,t=await c.overview(n);s(".hero-tokens").textContent=p(t.total_tokens),s("#hero-cost").textContent=w(t.total_cost_usd),s("#hero-sessions").textContent=b(t.session_count);const a=t.session_count?Math.round(t.total_tokens/t.session_count):0;s("#hero-avg").textContent=t.session_count?`· ${p(a)} tok/session`:"";const o=Object.entries(t.tokens_by_day).sort().map(([e,r])=>({day:e,value:r}));f?.dispose(),o.length?f=C(s("#line"),o):s("#line").innerHTML='<p class="empty">No activity in this window.</p>';const m=n==="all"?t:await c.overview("all"),l=Object.entries(m.tokens_by_day).sort().map(([e,r])=>({day:e,value:r}));h?.dispose(),h=A(s("#heatmap"),l,90);const i=Object.entries(t.tokens_by_model??{}).sort((e,r)=>r[1]-e[1]).map(([e,r])=>({name:e,value:r}));u?.dispose(),i.length?u=M(s("#models"),i):s("#models").innerHTML='<p class="empty">No data.</p>';const y=(t.top_sessions??[]).slice(0,8);s("#recent").innerHTML=y.length?`
        <table>
          <thead><tr><th>Started</th><th>Project</th><th>Model</th><th class="num">Tokens <span class="est">(in window)</span></th><th class="num">Cost <span class="est">(in window)</span></th></tr></thead>
          <tbody>
            ${y.map(e=>`
              <tr data-id="${encodeURIComponent(e.id)}">
                <td>${L(e.started_at)}${e.days_active>1?` <span style="color:var(--text-2);font-size:0.75rem;">+${e.days_active-1}d</span>`:""}</td>
                <td class="mono">${d(N(e.project_path))}</td>
                <td><code>${d(e.primary_model)}</code></td>
                <td class="num tok">${p(e.window_tokens)}</td>
                <td class="num cost">~${w(e.window_cost_usd)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`:'<p class="empty">No sessions in this window.</p>',s("#recent").querySelectorAll("tr[data-id]").forEach(e=>{e.addEventListener("click",()=>location.href="/session?id="+e.dataset.id)})}k.addEventListener("change",$);$();window.addEventListener("resize",()=>[f,h,u].forEach(n=>n?.resize()));const g=s("#alerts-body");v(g);j(g);
