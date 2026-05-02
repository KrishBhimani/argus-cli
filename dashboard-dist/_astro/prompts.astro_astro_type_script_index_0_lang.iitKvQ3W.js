import{a as r}from"./api.D62A6-WM.js";import{b as u}from"./format.cWKWqGW_.js";const n=t=>document.querySelector(t),c=n("#q"),p=n("#proj"),l=n("#slash");function d(t){if(!t)return"—";const e=t.split("/");return e[e.length-1]||t}function h(t){return t<1024?t+" B":t<1024*1024?(t/1024).toFixed(1)+" KB":(t/1024/1024).toFixed(1)+" MB"}function m(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function f(t){const e="\0MK_OPEN\0",s="\0MK_CLOSE\0",o=t.replace(/<mark>/g,e).replace(/<\/mark>/g,s);return m(o).replace(new RegExp(e,"g"),"<mark>").replace(new RegExp(s,"g"),"</mark>")}function v(t){if(t.length===0){n("#results").innerHTML=c.value?'<div class="empty">No prompts match this search.</div>':`<div class="empty">No prompts indexed yet. Use Claude Code and they'll appear here.</div>`;return}n("#results").innerHTML=t.map(e=>`
        <div class="prompt-card">
          <div class="prompt-meta">
            <span>${u(new Date(e.timestamp_ms).toISOString())} · <span class="proj">${m(d(e.project_path))}</span></span>
            <span>${e.pasted_chars>0?`<span class="pasted-tag">+ ${h(e.pasted_chars)} pasted</span>`:""}</span>
          </div>
          <div class="prompt-snippet">${f(e.snippet)}</div>
          <div class="prompt-actions">
            ${e.session_id?`<a href="/session?id=${encodeURIComponent(e.session_id)}">→ Open session</a>`:'<span class="nolink">(no linked session)</span>'}
          </div>
        </div>
      `).join("")}async function g(){try{const t=await r.promptStats(),e=n("#stats-strip");if(t.total===0)e.style.display="none";else{const s=t.oldest_ms?new Date(t.oldest_ms).toLocaleDateString():"—";e.style.display="",e.textContent=`${t.total.toLocaleString()} prompts · ${t.projects} projects · oldest ${s}`}}catch{}}async function y(){try{const{projects:t}=await r.promptProjects();for(const e of t){const s=document.createElement("option");s.value=e,s.textContent=d(e),p.appendChild(s)}}catch{}}let i;async function a(){const t=c.value.trim(),e=p.value||void 0,s=l.checked;n("#stats-strip").style.display=t||e?"none":"";const{prompts:o}=await r.prompts({q:t,limit:50,project:e,includeSlash:s});v(o)}function j(){clearTimeout(i),i=setTimeout(a,150)}c.addEventListener("input",j);p.addEventListener("change",a);l.addEventListener("change",a);g();y();a();
