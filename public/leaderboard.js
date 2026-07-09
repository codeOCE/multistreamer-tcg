(function(){"use strict";const k=(document.querySelector('meta[name="castle-public-url"]')?.content||"").replace(/\/$/,""),h=(()=>{const t=window.location.pathname.replace(/\/$/,"").split("/").filter(Boolean);return t.length>=1&&t[t.length-1]!=="leaderboard"?"":t[0]?t[0].toLowerCase():""})();function u(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}let R=[],w="collection",v=null,p=null,m="points",C=[],b=null,f="rating",B=!1;const x={legendary_count:20,epic_count:10,rare_count:5,uncommon_count:2,common_count:1};function I(t){let e=0;for(const n in x)e+=(Number(t[n])||0)*x[n];return e}function $(t,e){return e==="points"?I(t):Number(t[e])||0}const _=[{key:"points",label:"Points",short:"Points",cls:"lb-cell-points"},{key:"card_count",label:"Total Cards",short:"Cards",cls:""},{key:"legendary_count",label:"Legendary",short:"Leg",cls:"lb-r-legendary"},{key:"epic_count",label:"Epic",short:"Epic",cls:"lb-r-epic"},{key:"rare_count",label:"Rare",short:"Rare",cls:"lb-r-rare"},{key:"uncommon_count",label:"Uncommon",short:"Unc",cls:"lb-r-uncommon"},{key:"common_count",label:"Common",short:"Com",cls:"lb-r-common"}],T=[{key:"rating",label:"Castle Rank",short:"Castle Rank",cls:"lb-cell-points",noDim:!0},{key:"wins",label:"Wins",short:"Wins",cls:"lb-c-win"},{key:"losses",label:"Losses",short:"Losses",cls:"lb-c-loss"},{key:"win_rate",label:"Win %",short:"Win %",cls:"",fmt:t=>`${(Number(t)||0).toFixed(1)}%`},{key:"total_battles",label:"Total Battles",short:"Battles",cls:""}];(async function(){if(!h){L();return}try{const[e,n]=await Promise.all([fetch(`${k}/api/public/collection-page?streamer=${encodeURIComponent(h)}&lbv=2`),fetch(`${k}/api/auth/session`).catch(()=>null)]);if(!e.ok){L();return}const s=await e.json();if(!s.streamer){L();return}if(R=s.leaderboard||[],n&&n.ok){const o=await n.json().catch(()=>null);o&&o.user&&(v=o.user,V(o.user))}K(s.streamer.brand_color_primary),Y(s.streamer),y(),ot(),v&&F()}catch(e){console.error("[Leaderboard] init error",e),L()}})();async function F(){try{const t=await fetch(`${k}/api/public/collector-rank?streamer=${encodeURIComponent(h)}`,{credentials:"include"});if(!t.ok)return;p=(await t.json().catch(()=>null))?.rank||null,p&&w==="collection"&&y()}catch{}}async function z(){if(!B){B=!0;try{const t=await fetch(`${k}/api/public/battle-leaderboard?streamer=${encodeURIComponent(h)}&blv=3`);t.ok&&(C=(await t.json().catch(()=>null))?.leaderboard||[])}catch{}v&&G(),w==="battles"&&y()}}async function G(){try{const t=await fetch(`${k}/api/public/battle-rank?streamer=${encodeURIComponent(h)}`,{credentials:"include"});if(!t.ok)return;b=(await t.json().catch(()=>null))?.rank||null,b&&w==="battles"&&y()}catch{}}function V(t){if(!t)return;window.currentUser={...t,avatar:t.avatar_url||t.avatar};const e=document.getElementById("nav-avatar"),n=document.getElementById("nav-user-menu-avatar");e&&(e.src=window.currentUser.avatar||""),n&&(n.src=window.currentUser.avatar||"");const s=document.getElementById("nav-user-preview");s&&(s.classList.remove("hidden"),s.style.display="flex"),window.initNavUserMenu?.(),window.updateNavUserMenuLabels?.()}function K(t){if(!t||!/^#[0-9a-fA-F]{6}$/.test(t))return;const e=parseInt(t.slice(1,3),16),n=parseInt(t.slice(3,5),16),s=parseInt(t.slice(5,7),16),o=`${e}, ${n}, ${s}`,i=document.documentElement;i.style.setProperty("--page-accent",t),i.style.setProperty("--page-accent-rgb",o),i.style.setProperty("--void-accent",t),i.style.setProperty("--void-accent-rgb",o)}function Y(t){const e=t.brand_name||t.display_name||t.username||h,n=t.display_name||t.username||h,s=document.getElementById("lb-creator-name");s&&(s.textContent=e);const o=document.getElementById("lb-subtitle");o&&(o.textContent=`by ${n}`),document.title=`${e} \xB7 Leaderboard \xB7 Castle TCG`}window._lbSetTab=function(t){w=t,document.getElementById("lb-tab-collection")?.classList.toggle("active",t==="collection"),document.getElementById("lb-tab-battles")?.classList.toggle("active",t==="battles"),y(),document.getElementById("lb-info-modal")?.classList.contains("open")&&j()},window._lbSort=function(t){m=t,y()},window._lbSortBattle=function(t){f=t,y()};function y(){const t=document.getElementById("lb-board-title"),e=document.getElementById("lb-board-count"),n=document.getElementById("lb-list");n&&(w==="collection"?q(t,e,n):J(t,e,n))}function q(t,e,n){const s=R.filter(r=>(r.card_count??r.total_cards??0)>0);if(t&&(t.textContent="Collection Leaderboard"),e&&(e.textContent=s.length?`${s.length} collector${s.length!==1?"s":""}`:""),s.length===0){n.innerHTML='<div class="lb-empty">No collectors yet</div>';return}s.sort((r,l)=>{const a=$(r,m),d=$(l,m);return a===d?I(l)-I(r):d-a});const o=H(_,m,"_lbSort"),i=s.map((r,l)=>{const a=S(r.twitch_id),d=l<3?` lb-rank-${l+1}`:"";return`<tr class="${a?"lb-row-me":""}">
            <td class="lb-cell-rank${d}">${W(l)}</td>
            <td class="lb-cell-name">${M(r,a)}</td>
            ${E(r,_,m,$)}
        </tr>`}).join("");let c="";if(p&&p.twitch_id&&!s.some(r=>r.twitch_id===p.twitch_id)){const r=Number(p["rank_"+m]??p.rank_points??0);c=N(p,r,_,m,$)}n.innerHTML=U("Collector",_,m,"_lbSort",i,c)}function J(t,e,n){if(t&&(t.textContent="Battle Leaderboard"),!B){e&&(e.textContent=""),n.innerHTML='<div class="lb-empty">Loading battles...</div>',z();return}const s=C.filter(l=>(Number(l.total_battles)||0)>0);if(e&&(e.textContent=s.length?`${s.length} fighter${s.length!==1?"s":""}`:""),s.length===0){n.innerHTML='<div class="lb-empty">No battles recorded yet</div>';return}const o=(l,a)=>Number(l[a])||0;s.sort((l,a)=>{const d=o(l,f),g=o(a,f);return d===g?o(a,"rating")-o(l,"rating"):g-d});const i=s.map((l,a)=>{const d=S(l.twitch_id),g=a<3?` lb-rank-${a+1}`:"";return`<tr class="${d?"lb-row-me":""}">
            <td class="lb-cell-rank${g}">${W(a)}</td>
            <td class="lb-cell-name">${M(l,d)}</td>
            ${E(l,T,f,o)}
            ${A(l)}
        </tr>`}).join("");let c="";if(b&&b.twitch_id&&!s.some(l=>l.twitch_id===b.twitch_id)){const l=Number(b["rank_"+f]??b.rank_rating??0);c=N(b,l,T,f,o,A(b))}const r='<th class="lb-col-deck">Active Deck</th>';n.innerHTML=U("Fighter",T,f,"_lbSortBattle",i,c,r)}function S(t){return!!v&&(t===v.uid||t===v.twitch_id)}function H(t,e,n){return t.map(s=>{const o=s.key===e;return`<th class="lb-col-num${o?" lb-sort-active":""}" title="Sort by ${s.label}"
            onclick="window.${n}('${s.key}')">${s.short}${o?'<span class="lb-sort-arrow">\u25BC</span>':""}</th>`}).join("")}function E(t,e,n,s){return e.map(o=>{const i=s?s(t,o.key):Number(t[o.key])||0,c=o.key===n?" lb-col-sorted":"",r=i===0&&!o.noDim?"lb-zero":o.cls,l=o.fmt?o.fmt(i):i;return`<td class="lb-col-num${c}"><span class="${r}">${l}</span></td>`}).join("")}function N(t,e,n,s,o,i=""){return`<tr class="lb-viewer-sep"><td colspan="${n.length+2+(i?1:0)}"></td></tr>
        <tr class="lb-row-me lb-row-viewer">
            <td class="lb-cell-rank">#${e}</td>
            <td class="lb-cell-name">${M(t,!0)}</td>
            ${E(t,n,s,o)}
            ${i}
        </tr>`}function U(t,e,n,s,o,i,c=""){return`<div class="lb-table-wrap"><table class="lb-table">
        <thead><tr>
            <th class="lb-col-rank">#</th>
            <th class="lb-col-name">${t}</th>
            ${H(e,n,s)}
            ${c}
        </tr></thead>
        <tbody>${o}${i}</tbody>
    </table></div>`}function A(t){const e=t&&t.deck;if(!Array.isArray(e)||e.length===0)return'<td class="lb-cell-deck"><span class="lb-deck-empty">None</span></td>';const n=e.slice(0,3).map(s=>{const o=s&&s.image,i=u(s&&s.name||"");return o?`<span class="lb-deck-slot"><img src="${u(o)}" alt="${i}" loading="lazy"
            onerror="this.style.visibility='hidden'"></span>`:'<span class="lb-deck-slot"></span>'}).join("");return`<td class="lb-cell-deck"><div class="lb-deck" data-owner="${u(t.twitch_id||"")}"
        onmouseenter="window._lbDeckTip(event,this)" onmouseleave="window._lbDeckHide()">${n}</div></td>`}function Q(t){const e=C.find(n=>n.twitch_id===t);return e?e.deck:b&&b.twitch_id===t?b.deck:null}function X(){let t=document.getElementById("lb-deck-tip");return t||(t=document.createElement("div"),t.id="lb-deck-tip",document.body.appendChild(t)),t}const Z={legendary:"#fbbf24",epic:"#c084fc",rare:"#60a5fa",uncommon:"#4ade80",common:"rgba(255,255,255,0.18)"},tt='<svg class="lb-swords" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3v5l-11 9l-4 4l-3-3l4-4l9-11z"/><path d="M5 13l6 6"/><path d="M14.32 17.32l3.68 3.68l3-3l-3.68-3.68"/><path d="M19 3l-6 6"/></svg>';function D(t){if(!t)return"";const e=t.icon||"",n=u(t.name||""),s=e.startsWith("/")||e.startsWith("http");return`<span class="lb-tip-pip" title="${n}">${s?`<img src="${u(e)}" alt="${n}">`:u(e)}</span>`}window._lbDeckTip=function(t,e){const n=Q(e.dataset.owner);if(!Array.isArray(n)||!n.length)return;const s=n.slice(0,3).map(a=>{const d=a&&a.image,g=u(a&&a.name||""),O=Z[String(a&&a.rarity||"").toLowerCase()]||"rgba(255,255,255,0.12)",at=d?`<img src="${u(d)}" alt="${g}" style="border-color:${O}" onerror="this.style.visibility='hidden'">`:`<div class="lb-tip-noimg" style="border-color:${O}"></div>`,lt=a&&a.attack!=null?a.attack:"-",it=a&&a.defense!=null?a.defense:"-",P=[D(a&&a.mechanic),D(a&&a.genesis)].join("");return`<div class="lb-tip-card">
            ${at}
            <span class="lb-tip-name">${g||"&nbsp;"}</span>
            <div class="lb-tip-stats">
                <span class="lb-tip-atk">${tt}${lt}</span>
                <span class="lb-tip-def"><i class="bx bxs-shield"></i>${it}</span>
            </div>
            ${P.trim()?`<div class="lb-tip-pips">${P}</div>`:""}
        </div>`}).join(""),o=X();o.innerHTML=`<div class="lb-tip-title">Active Deck</div><div class="lb-tip-cards">${s}</div>`,o.classList.add("show");const i=e.getBoundingClientRect(),c=o.getBoundingClientRect();let r=i.left+i.width/2-c.width/2;r=Math.max(8,Math.min(r,window.innerWidth-c.width-8));let l=i.top-c.height-10;l<8&&(l=i.bottom+10),o.style.left=`${r}px`,o.style.top=`${l}px`},window._lbDeckHide=function(){document.getElementById("lb-deck-tip")?.classList.remove("show")};function M(t,e){const n=u(t.display_name||t.username||t.twitch_id||"Unknown"),s=e?'<span class="lb-you-badge">You</span>':"";return`<div class="lb-name-inner">${et(t)}<span class="lb-name-txt">${n}</span>${s}</div>`}function W(t){return t===0?"\u{1F947}":t===1?"\u{1F948}":t===2?"\u{1F949}":`#${t+1}`}function et(t){const e=u(t.display_name||t.username||t.twitch_id||"?"),n=e.charAt(0).toUpperCase();return t.avatar_url?`<img class="lb-avatar" src="${u(t.avatar_url)}" alt="${e}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span
            class="lb-avatar lb-avatar-fallback" style="display:none">${n}</span>`:`<span class="lb-avatar lb-avatar-fallback">${n}</span>`}const nt=`
    <div class="lb-info-section">
        <h3><i class="bx bxs-star"></i> Points</h3>
        <p>Your score comes from the cards you <strong>own right now</strong>. Rarer cards are worth more, so chasing legendaries pays off. When you pull or trade for new cards, your points go up.</p>
        <div class="lb-info-weights">
            <div><span class="lb-r-legendary">Legendary</span><b>20 pts</b></div>
            <div><span class="lb-r-epic">Epic</span><b>10 pts</b></div>
            <div><span class="lb-r-rare">Rare</span><b>5 pts</b></div>
            <div><span class="lb-r-uncommon">Uncommon</span><b>2 pts</b></div>
            <div><span class="lb-r-common">Common</span><b>1 pt</b></div>
        </div>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-sort-down"></i> Sorting</h3>
        <p>The board ranks by <strong>Points</strong> to start. Want to see who has the most of something? Tap any column header (Cards or a rarity) to rank by that. It always puts the highest at the top.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-list-ol"></i> Top 100 &amp; your spot</h3>
        <p>Only the top 100 collectors show up here. If you're signed in and sitting below 100, your own spot gets pinned at the bottom so you can always find yourself.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-collection"></i> Columns</h3>
        <p><strong>Cards</strong> is how many cards you own in total. The rarity columns break that down by how many of each you've got.</p>
    </div>`,st=`
    <div class="lb-info-section">
        <h3><i class="bx bxs-trophy"></i> Castle Rank</h3>
        <p><strong>Castle Rank</strong> is your battle rating. Win a battle and it climbs, lose and it drops.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-sort-down"></i> Sorting</h3>
        <p>The board ranks by <strong>Castle Rank</strong> to start. Tap any column header to rank by Wins, Losses, Win %, or Total Battles instead. It always puts the highest at the top.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-list-ol"></i> Top 100 &amp; your spot</h3>
        <p>Only the top 100 fighters show up here. If you're signed in and sitting below 100, your own spot gets pinned at the bottom so you can always find yourself.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bxs-grid-alt"></i> Active Deck</h3>
        <p>The last column shows the three cards each fighter battles with. Hover a deck to see each card's attack, defense, and traits.</p>
    </div>`;function j(){const t=w==="battles",e=document.getElementById("lb-info-eyebrow"),n=document.getElementById("lb-info-body");e&&(e.textContent=t?"Battles":"Collection"),n&&(n.innerHTML=t?st:nt)}window._lbOpenInfo=function(){j(),document.getElementById("lb-info-modal")?.classList.add("open")},window._lbCloseInfo=function(t){t&&t.type==="click"&&t.target&&t.target.id!=="lb-info-modal"||document.getElementById("lb-info-modal")?.classList.remove("open")},document.addEventListener("keydown",t=>{t.key==="Escape"&&window._lbCloseInfo()});function ot(){document.getElementById("lb-loading")?.classList.add("hidden"),document.getElementById("lb-main")?.classList.remove("hidden"),document.getElementById("lb-info-btn")?.classList.remove("hidden")}function L(){document.getElementById("lb-loading")?.classList.add("hidden"),document.getElementById("lb-not-found")?.classList.remove("hidden")}})();
