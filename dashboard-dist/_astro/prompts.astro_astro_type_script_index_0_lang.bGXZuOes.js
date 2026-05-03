import{a as l}from"./api.CtD6fQqN.js";import{a as v}from"./format.DZCscyiN.js";const n=e=>document.querySelector(e),p=e=>Array.from(document.querySelectorAll(e)),a=n("#q"),c=n("#proj"),u=n("#slash");function d(e){if(!e)return"—";const s=e.split("/");return s[s.length-1]||e}function f(e){return e<1024?e+" B":e<1024*1024?(e/1024).toFixed(1)+" KB":(e/1024/1024).toFixed(1)+" MB"}function m(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function g(e){const s="\0MK_OPEN\0",t="\0MK_CLOSE\0",o=e.replace(/<mark>/g,s).replace(/<\/mark>/g,t);return m(o).replace(new RegExp(s,"g"),"<mark>").replace(new RegExp(t,"g"),"</mark>")}function y(e){switch(e){case"prompt":return"you typed";case"user":return"you said";case"assistant":return"claude said";case"thinking":return"claude thinking";case"tool_result":return"tool output";default:return e}}function $(){return p(".role-toggle input").filter(e=>e.checked).map(e=>e.dataset.role)}function L(e){const s=n("#totals");if(a.value.trim()?(s.style.display="",s.innerHTML=`${e.total.toLocaleString()} matches: <span style="color:var(--accent);">${e.prompt_total.toLocaleString()}</span> in your prompts, <span style="color:var(--codex);">${e.transcript_total.toLocaleString()}</span> in transcripts`):s.style.display="none",e.results.length===0){n("#results").innerHTML=a.value?'<div class="empty">No matches.</div>':'<div class="empty">Type something to search across every prompt and every transcript.</div>';return}n("#results").innerHTML=e.results.map(t=>`
        <div class="result-card">
          <div class="result-meta">
            <span>
              <span class="role-pill role-${t.role}">${y(t.role)}</span>
              <span style="margin-left:0.5rem;">${v(new Date(t.timestamp_ms).toISOString())} · ${m(d(t.project_path))}</span>
            </span>
            <span>${t.pasted_chars>0?`<span class="pasted-tag">+ ${f(t.pasted_chars)} pasted</span>`:""}</span>
          </div>
          <div class="result-snippet">${g(t.snippet)}</div>
          <div class="result-actions">
            ${t.session_id?`<a href="/session?id=${encodeURIComponent(t.session_id)}${a.value.trim()?"&q="+encodeURIComponent(a.value.trim()):""}">→ Open session</a>`:'<span class="nolink">(no linked session)</span>'}
          </div>
        </div>
      `).join("")}async function S(){try{const{projects:e}=await l.promptProjects();for(const s of e){const t=document.createElement("option");t.value=s,t.textContent=d(s),c.appendChild(t)}}catch{}}let i;async function r(){const e=a.value.trim(),s=c.value||void 0,t=u.checked,o=$();try{const h=await l.search({q:e,limit:100,project:s,includeSlash:t,roles:o});L(h)}catch{n("#results").innerHTML='<div class="empty">Search failed.</div>'}}function k(){clearTimeout(i),i=setTimeout(r,150)}a.addEventListener("input",k);c.addEventListener("change",r);u.addEventListener("change",r);p(".role-toggle input").forEach(e=>e.addEventListener("change",r));S();r();
