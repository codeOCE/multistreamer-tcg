(function(){"use strict";const y=(()=>{const e=document.querySelector('meta[name="castle-public-url"]');return e?e.content.replace(/\/$/,""):window.location.origin})();let a=null,i=null,d="",o={},r=!1;function x(){return new Promise((e,t)=>{if(window.Stripe)return e();const n=document.createElement("script");n.src="https://js.stripe.com/v3/",n.onload=()=>e(),n.onerror=()=>t(new Error("Failed to load Stripe.")),document.head.appendChild(n)})}async function h(){if(d)return d;try{const e=await fetch(`${y}/api/csrf`,{credentials:"include"});e.ok&&(d=(await e.json()).token||"")}catch{}return d}function v(){return getComputedStyle(document.documentElement).getPropertyValue("--void-accent").trim()||"#6366f1"}function w(){if(document.getElementById("cm-styles"))return;const e=`
      #cm-overlay {
        position: fixed; inset: 0; z-index: 12000;
        display: flex; align-items: center; justify-content: center; padding: 20px;
        background: rgba(5,7,10,0.86); backdrop-filter: blur(14px);
        opacity: 0; pointer-events: none; transition: opacity 0.2s;
        font-family: 'Space Grotesk', system-ui, sans-serif;
      }
      #cm-overlay.open { opacity: 1; pointer-events: auto; }
      #cm-panel {
        width: 100%; max-width: 440px; max-height: 92vh; overflow-y: auto;
        background: #12141c; border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.6);
        transform: translateY(8px) scale(0.99); transition: transform 0.2s;
      }
      #cm-overlay.open #cm-panel { transform: none; }
      #cm-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      #cm-title {
        font-weight: 900; font-size: 0.95rem; letter-spacing: 0.02em;
        text-transform: uppercase; color: #e7e9ee; margin: 0;
      }
      #cm-sub { font-size: 0.6rem; color: #8a8f9c; margin-top: 3px; letter-spacing: 0.04em; }
      #cm-close {
        width: 32px; height: 32px; border-radius: 9px; border: none; flex-shrink: 0;
        background: rgba(255,255,255,0.05); color: #8a8f9c; cursor: pointer; font-size: 1.3rem; line-height: 1;
      }
      #cm-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
      #cm-body { padding: 18px 20px 22px; }
      #cm-amount {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px dashed rgba(255,255,255,0.08);
      }
      #cm-amount .lbl { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.18em; color: #8a8f9c; }
      #cm-amount .val { font-size: 1.4rem; font-weight: 900; color: #e7e9ee; }
      #cm-payment-element { min-height: 40px; margin-bottom: 16px; }
      #cm-error {
        display: none; font-size: 0.68rem; color: #f87171; margin-bottom: 12px;
        background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
        border-radius: 10px; padding: 9px 12px;
      }
      #cm-error.show { display: block; }
      #cm-pay {
        width: 100%; padding: 13px; border: none; border-radius: 12px; cursor: pointer;
        background: var(--void-accent, #6366f1); color: #fff;
        font-family: inherit; font-weight: 900; font-size: 0.8rem;
        letter-spacing: 0.08em; text-transform: uppercase; transition: opacity 0.15s, transform 0.1s;
      }
      #cm-pay:hover:not(:disabled) { opacity: 0.9; }
      #cm-pay:active:not(:disabled) { transform: scale(0.99); }
      #cm-pay:disabled { opacity: 0.5; cursor: not-allowed; }
      #cm-loading, #cm-success {
        display: none; flex-direction: column; align-items: center; justify-content: center;
        gap: 12px; padding: 40px 20px; text-align: center; color: #8a8f9c; font-size: 0.75rem;
      }
      #cm-loading.show, #cm-success.show { display: flex; }
      #cm-success .ico { font-size: 2.4rem; color: var(--void-accent, #6366f1); }
      #cm-success .msg { color: #e7e9ee; font-weight: 800; font-size: 0.9rem; }
      .cm-spin { width: 28px; height: 28px; border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.12); border-top-color: var(--void-accent, #6366f1);
        animation: cm-spin 0.7s linear infinite; }
      @keyframes cm-spin { to { transform: rotate(360deg); } }
      #cm-secure { margin-top: 12px; text-align: center; font-size: 0.55rem; color: #6b7280; letter-spacing: 0.06em; }
    `,t=document.createElement("style");t.id="cm-styles",t.textContent=e,document.head.appendChild(t)}function E(){if(document.getElementById("cm-overlay"))return;const e=document.createElement("div");e.id="cm-overlay",e.addEventListener("click",t=>{t.target===e&&!r&&m()}),e.innerHTML=`
      <div id="cm-panel" role="dialog" aria-modal="true" aria-label="Checkout">
        <div id="cm-head">
          <div>
            <p id="cm-title">Get Packs</p>
            <div id="cm-sub"></div>
          </div>
          <button id="cm-close" aria-label="Close">&times;</button>
        </div>
        <div id="cm-loading" class="show"><div class="cm-spin"></div><span>Preparing secure checkout\u2026</span></div>
        <div id="cm-success"><div class="ico"><i class="bx bxs-check-circle"></i></div><div class="msg">Payment received!</div><span>Your pack is on its way.</span></div>
        <div id="cm-body" style="display:none">
          <div id="cm-amount"><span class="lbl">Total</span><span class="val" id="cm-amount-val">\u2014</span></div>
          <div id="cm-payment-element"></div>
          <div id="cm-error"></div>
          <button id="cm-pay" type="button"><span id="cm-pay-label">Pay</span></button>
          <div id="cm-secure"><i class="bx bx-lock-alt"></i> Secured by Stripe</div>
        </div>
      </div>`,document.body.appendChild(e),document.getElementById("cm-close").addEventListener("click",()=>{r||m()}),document.getElementById("cm-pay").addEventListener("click",I),document.addEventListener("keydown",t=>{t.key==="Escape"&&!r&&document.getElementById("cm-overlay")?.classList.contains("open")&&m()})}function l(e){document.getElementById("cm-loading").classList.toggle("show",e==="loading"),document.getElementById("cm-success").classList.toggle("show",e==="success");const t=document.getElementById("cm-body");t&&(t.style.display=e==="form"?"":"none")}function f(e){const t=document.getElementById("cm-error");t&&(t.textContent=e||"Something went wrong.",t.classList.add("show"))}function g(){const e=document.getElementById("cm-error");e&&(e.textContent="",e.classList.remove("show"))}function k(){const e=document.getElementById("cm-overlay");e&&(e.style.display="flex",requestAnimationFrame(()=>e.classList.add("open"))),document.body.style.overflow="hidden"}function m(){const e=document.getElementById("cm-overlay");e&&(e.classList.remove("open"),setTimeout(()=>{e.style.display="none"},200)),document.body.style.overflow="";try{i=null,a=null}catch{}const t=document.getElementById("cm-payment-element");t&&(t.innerHTML=""),r=!1}function b(e,t){try{return new Intl.NumberFormat(void 0,{style:"currency",currency:(t||"usd").toUpperCase()}).format((e||0)/100)}catch{return`$${((e||0)/100).toFixed(2)}`}}window.openCheckout=async function(e){if(o=e||{},!o.streamerId){console.warn("[checkout] no streamerId");return}w(),E(),g(),l("loading"),o.creatorName&&(document.getElementById("cm-sub").textContent=`Supporting ${o.creatorName}`),k();try{await x();const t=await h(),n=o.paymentIntentPath||"/api/payment/create-payment-intent",s=o.paymentIntentBody!==void 0?o.paymentIntentBody:{streamer_id:o.streamerId},p=await fetch(`${y}${n}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","X-CSRF-Token":t},body:JSON.stringify(s)}),c=await p.json().catch(()=>({}));if(!p.ok)throw new Error(c.error||"Could not start checkout.");if(!c.client_secret||!c.publishable_key)throw new Error("Checkout is not configured.");c.creator_name&&!o.creatorName&&(document.getElementById("cm-sub").textContent=`Supporting ${c.creator_name}`),document.getElementById("cm-amount-val").textContent=b(c.amount,c.currency),document.getElementById("cm-pay-label").textContent=`Pay ${b(c.amount,c.currency)}`,a=Stripe(c.publishable_key);const u=v();i=a.elements({clientSecret:c.client_secret,appearance:{theme:"night",variables:{colorPrimary:u,colorBackground:"#0e1017",colorText:"#e7e9ee",colorTextSecondary:"#8a8f9c",colorDanger:"#f87171",fontFamily:'"Space Grotesk", system-ui, sans-serif',borderRadius:"10px",spacingUnit:"4px"},rules:{".Input":{border:"1px solid rgba(255,255,255,0.1)",boxShadow:"none"},".Input:focus":{border:`1px solid ${u}`,boxShadow:"none"},".Label":{color:"#8a8f9c",fontWeight:"700"},".Tab":{border:"1px solid rgba(255,255,255,0.1)"},".Tab--selected":{borderColor:u}}}}),i.create("payment",{layout:"tabs"}).mount("#cm-payment-element"),l("form")}catch(t){l("form"),document.getElementById("cm-payment-element").innerHTML=`<div style="color:#8a8f9c;font-size:0.75rem;text-align:center;padding:20px">${t&&t.message||"Checkout unavailable."}</div>`;const n=document.getElementById("cm-pay");n&&(n.style.display="none")}};async function I(){if(!a||!i||r)return;r=!0,g();const e=document.getElementById("cm-pay"),t=document.getElementById("cm-pay-label");e&&(e.disabled=!0),t&&(t.textContent="Processing\u2026");const{error:n,paymentIntent:s}=await a.confirmPayment({elements:i,redirect:"if_required"});if(n){f(n.message),r=!1,e&&(e.disabled=!1),t&&(t.textContent="Try again");return}if(s&&(s.status==="succeeded"||s.status==="processing")){l("success");try{typeof o.onSuccess=="function"&&o.onSuccess()}catch{}setTimeout(()=>{o.successUrl?window.location.href=o.successUrl:m()},1400);return}f("Payment could not be completed. Please try again."),r=!1,e&&(e.disabled=!1),t&&(t.textContent="Pay")}})();
