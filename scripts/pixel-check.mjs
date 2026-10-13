#!/usr/bin/env node
// pixel-check.mjs — inventario de tags de medición/marketing por página (check 3 del QA Gate, Paso 6.5).
//
// El preview debe disparar los MISMOS tags que el live. Se corre desde la carpeta del proyecto.
//
// Uso:
//   node <toolkit>/scripts/pixel-check.mjs --save-expect data/tags.json          (live → lista de esperados)
//   node <toolkit>/scripts/pixel-check.mjs --preview --expect data/tags.json     (QA Gate: exit 1 si falta un tag)
//   node <toolkit>/scripts/pixel-check.mjs --url URL [--url URL ...] [--preview-theme-id ID] \
//        [--out data/pixel-check-live.json] [--expect data/tags.json] [--save-expect data/tags.json] \
//        [--wait 8000] [--no-interact] [--atc-checkout] [--mobile] [--chrome /ruta/chrome] [--keep-raw] \
//        [--sgtm-host gtm.midominio.com]
//
// - Sin --url: HOME_URL, PDP_URL y COLLECTION_URL del .env. --preview = --preview-theme-id $WORK_THEME_ID.
// - Default --out: data/pixel-check-live.json o data/pixel-check-preview.json.
// - --sgtm-host (o SGTM_HOST en .env, separados por coma): dominio propio de GTM server-side / Stape.
// - --save-expect: escribe {esperados:[{plataforma,id}]} con los tags de medición detectados (revisar a mano:
//   marca "opcional": true los que no son obligatorios y cruza con CONSTRAINTS.md).
//
// - Cada URL se carga en un contexto de navegador NUEVO (perfil temporal, sin caché ni cookies).
// - networkidle + --wait ms, scroll completo, y en PDP: clic en una variante + add-to-cart
//   (si no hay botón de carrito, con --atc-checkout se pulsa el CTA "comprar ahora" y se espera el checkout;
//   sin el flag se hace POST /cart/add.js desde la página para que los pixels vean product_added_to_cart).
// - Se capturan TODOS los requests (página, iframes, workers de los Web Pixels de Shopify) vía CDP
//   con auto-attach, con bytes transferidos (encodedDataLength).
// - Con --expect compara contra data/tags.json (lista de {plataforma, id}) y sale con código 1
//   si falta algún tag esperado (o si aparece uno nuevo, se avisa sin fallar).
//
// Dependencias: puppeteer-core del toolkit (npm install en la raíz del toolkit). Chrome local:
// --chrome > $CHROME_PATH > rutas conocidas (findChrome de theme-lib.mjs).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { projectEnv, findChrome as findChromeLib } from './theme-lib.mjs';

// ---------- args (admite --url repetido) ----------
function parseArgs(argv) {
  const a = { url: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    const val = next && !next.startsWith('--') ? (i++, next) : true;
    if (key === 'url') a.url.push(val);
    else a[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const ENV = projectEnv();
if (!args.url.length) args.url = [ENV.HOME_URL, ENV.PDP_URL, ENV.COLLECTION_URL].filter(Boolean);
if (!args.url.length) {
  console.error('Uso: --url URL [--url URL ...] (o HOME_URL/PDP_URL/COLLECTION_URL en .env) [--preview | --preview-theme-id ID] [--out f.json] [--expect data/tags.json] [--save-expect data/tags.json]');
  process.exit(2);
}
if (args.preview) {
  if (!ENV.WORK_THEME_ID) { console.error('--preview requiere WORK_THEME_ID en .env'); process.exit(2); }
  args.previewThemeId = ENV.WORK_THEME_ID;
}
if (!args.out) args.out = args.previewThemeId && args.previewThemeId !== true ? 'data/pixel-check-preview.json' : 'data/pixel-check-live.json';
const WAIT = Number(args.wait || 8000);
const findChrome = () => findChromeLib(args.chrome);

// Hosts propios (no se listan como terceros): dominios de las URLs + myshopify + CDNs de Shopify/fuentes.
const esc = (h) => h.replace(/^www\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ownDomains = [...new Set([...args.url.map((u) => new URL(u).hostname), ENV.SHOPIFY_STORE].filter(Boolean).map((h) => h.replace(/^https?:\/\//, '').replace(/\/.*$/, '')))];
const SGTM_HOSTS = String((typeof args.sgtmHost === 'string' && args.sgtmHost) || ENV.SGTM_HOST || '').split(',').map((h) => h.trim()).filter(Boolean);
const SGTM_RE = SGTM_HOSTS.length ? new RegExp(`//(${SGTM_HOSTS.map(esc).join('|')})/`) : null;

function withPreview(url) {
  if (!args.previewThemeId || args.previewThemeId === true) return url;
  const u = new URL(url);
  u.searchParams.set('preview_theme_id', String(args.previewThemeId));
  return u.toString();
}

// ---------- clasificación ----------
// Cada regla: plataforma, test(url) y extractores de id/evento.
const qp = (u, k) => { try { return new URL(u).searchParams.get(k); } catch { return null; } };
const RULES = [
  { p: 'GA4', t: u => /\/g\/collect\b/.test(u), id: u => qp(u, 'tid'), ev: (u, body) => gaEvents(u, body), hit: true },
  { p: 'Universal Analytics (UA, obsoleto)', t: u => /google-analytics\.com\/(analytics|ga)\.js|\/gtag\/js\?id=UA-|google-analytics\.com\/(r\/)?collect\?/.test(u), id: u => qp(u, 'id') || qp(u, 'tid'), hit: u => /\/collect\?/.test(u) },
  { p: 'Google tag (gtag.js)', t: u => /\/gtag\/(js|destination)\?/.test(u), id: u => qp(u, 'id'), via: u => /googletagmanager\.com/.test(u) ? 'googletagmanager.com' : new URL(u).hostname },
  { p: 'Google Merchant Center', t: u => /merchant-center-analytics\.goog/.test(u), id: u => qp(u, 'tid'), ev: u => qp(u, 'en') ? [qp(u, 'en')] : [], hit: true },
  { p: 'Google Tag Manager', t: u => /googletagmanager\.com\/gtm\.js/.test(u), id: u => qp(u, 'id') },
  { p: 'Google Ads', t: u => /googleadservices\.com\/pagead|googleads\.g\.doubleclick\.net\/pagead|google\.[a-z.]+\/pagead\/1p-|\/pagead\/(viewthrough)?conversion|\/ccm\/(collect|conversion)|\/rmkt\/collect/.test(u),
    id: u => (u.match(/\/(?:viewthroughconversion|conversion|1p-user-list|1p-conversion)\/(\d+)/) || [])[1] || (qp(u, 'tid') || '').replace(/^AW-/, '') || null,
    ev: u => { const d = qp(u, 'data'); const m = d && d.match(/event=([^;]+)/); return m ? [m[1]] : (qp(u, 'en') ? [qp(u, 'en')] : ['conversion/remarketing']); }, hit: u => !/\/ccm\/collect|1p-user-list|rmkt/.test(u) },
  { p: 'Google (DoubleClick/otros)', t: u => /(doubleclick\.net|google\.com\/(rmkt|ads\/ga-audiences))/.test(u) },
  { p: 'Meta Pixel', t: u => /facebook\.com\/tr\b|facebook\.com\/privacy_sandbox|connect\.facebook\.net/.test(u),
    id: u => qp(u, 'id') || (u.match(/signals\/config\/(\d+)/) || [])[1] || null,
    ev: (u, body) => { const e = qp(u, 'ev') || (body && (String(body).match(/(?:^|&)ev=([^&]+)/) || [])[1]); return e ? [decodeURIComponent(e)] : []; },
    hit: u => /facebook\.com\/tr\b/.test(u) },
  { p: 'TikTok Pixel', t: u => /tiktok\.com|tiktokcdn|ttwstatic|tiktokw\.us/.test(u),
    id: (u, body) => qp(u, 'sdkid') || (body && (String(body).match(/"pixel_code"\s*:\s*"([A-Z0-9]+)"/) || [])[1]) || null,
    ev: (u, body) => body ? [...String(body).matchAll(/"event"\s*:\s*"([^"]+)"/g)].map(m => m[1]) : [],
    hit: u => /analytics\.tiktok\.com\/api\//.test(u) },
  { p: 'Pinterest', t: u => /pinterest\.com|pinimg\.com\/ct/.test(u), id: u => qp(u, 'tid'), ev: u => qp(u, 'event') ? [qp(u, 'event')] : [], hit: u => /ct\.pinterest\.com\/v3/.test(u) },
  { p: 'Snapchat', t: u => /snapchat\.com|sc-static\.net/.test(u), hit: u => /tr\.snapchat\.com/.test(u) },
  { p: 'Microsoft Clarity', t: u => /clarity\.ms/.test(u), id: u => (u.match(/clarity\.ms\/tag\/([a-z0-9]+)/) || [])[1] || null, hit: u => /\/collect/.test(u), ev: u => /\/collect/.test(u) ? ['grabación de sesión'] : [] },
  { p: 'Microsoft Ads (UET)', t: u => /bat\.bing\.com/.test(u), id: u => qp(u, 'ti'), hit: u => /bat\.bing\.com\/action/.test(u) },
  { p: 'Hotjar', t: u => /hotjar\.(com|io)/.test(u), id: u => (u.match(/hotjar-(\d+)/) || [])[1] || null },
  { p: 'Klaviyo', t: u => /klaviyo\.com|d3k81ch9hvuctc\.cloudfront\.net/.test(u), id: u => qp(u, 'company_id') || null,
    ev: (u, body) => { const s = String(body || ''); const m = [...s.matchAll(/"(?:metric|name)"\s*:\s*\{?[^}]*?"name"\s*:\s*"([^"]+)"/g)].map(x => x[1]); return m.length ? m : (/\/client\/events|\/onsite\/track-analytics/.test(u) ? ['evento'] : []); },
    hit: u => /\/client\/(events|profiles)|track-analytics|\/onsite\/.*track/.test(u) },
  { p: 'Shopify Web Pixels Manager', t: u => /\/wpm@|web-pixels(-manager)?[@.]/.test(u) },
  { p: 'Shopify Analytics (monorail)', t: u => /monorail|\/\.well-known\/shopify\/monorail|\/api\/collect|shop\.app\/pay\/session/.test(u), hit: true,
    ev: (u, body) => { const s = String(body || ''); return [...new Set([...s.matchAll(/"schema_id"\s*:\s*"([^"]+)"/g)].map(m => m[1]))]; } },
  { p: 'Stape / GTM server-side', t: u => /stape\.(io|net)|stapecdn\.com|stape-remix/.test(u) || (SGTM_RE ? SGTM_RE.test(u) : false), id: u => (u.match(/shop_id=(\d+)/) || [])[1] || (/^GTM-/.test(qp(u, 'id') || '') ? qp(u, 'id') : null), hit: u => /\/(g\/collect|data|event|td)\?/.test(u) },
  { p: 'HubSpot', t: u => /hubspot|hubapi|hs-scripts|hs-analytics|hs-banner|hscollectedforms|hsforms|hs-website-interactive/.test(u), id: u => (u.match(/\/(\d{6,})\.js/) || [])[1] || qp(u, 'a') || null, hit: u => /__ptq\.gif|website-interactive|collected-forms|\/submissions|\/forms\/v2/.test(u), ev: u => /website-interactive\/([a-z-]+)/.test(u) ? [u.match(/website-interactive\/([a-z-]+)/)[1]] : (/__ptq/.test(u) ? ['page_view'] : []) },
  { p: 'Shopify (Shop Pay / telemetría)', t: u => /shop\.app\/|extensions\.shopifycdn\.com|otlp-http-production|shopifysvc\.com/.test(u) },
  { p: 'EG Auto Add to Cart', t: u => /506\.io/.test(u) },
  { p: 'Revie (reseñas en video)', t: u => /revie/.test(u) },
  { p: 'Intelligems', internal: true, t: u => /intelligems\.io/.test(u) },
  { p: 'Heatmap.com', internal: true, t: u => /heatmap\.com|heatmapcore\.com/.test(u), hit: u => /heatmap\.php|conversions\.|srevents\.|visits\.|clicks\.|hsr\./.test(u) },
  { p: 'Zigpoll', internal: true, t: u => /zigpoll/.test(u) },
  { p: 'Alia', internal: true, t: u => /alia(-|\.)[a-z]*\.(com|io|app)|alia\.(com|io|app)|getalia|useAlia/i.test(u) },
  { p: 'Elevar', t: u => /getelevar|elevar\.io/.test(u) },
  { p: 'Analyzify', t: u => /analyzify/.test(u) },
  { p: 'UpPromote (afiliados)', t: u => /uppromote|secomapp|d1639lhkj5l89m\.cloudfront/.test(u) },
  { p: 'Neosocios (atribución)', t: u => /neosocios/.test(u) },
  { p: 'WATI (WhatsApp)', t: u => /wati\.io/.test(u), hit: u => /pixel\/events/.test(u) },
  { p: 'Payflow (checkout insights)', t: u => /payflow/.test(u), hit: true },
  { p: 'Tolstoy (video)', t: u => /gotolstoy|tolstoy/.test(u), hit: u => /events|analytics|collect/.test(u) },
  { p: 'Clipara (video)', t: u => /clipara/.test(u), hit: u => /events|analytics|collect/.test(u) },
  { p: 'Smind', t: u => /smind/.test(u) },
  { p: 'Mercado Pago antifraude', t: u => /mercadopago|mercadolibre|mlstatic/.test(u) },
  { p: 'GeoJS (geolocalización IP)', t: u => /geojs\.io/.test(u) },
  { p: 'Boostmark country blocker', t: u => /boostmark|country-blocker|bm-country/.test(u) },
  { p: 'Hulk Form Builder', t: u => /hulkapps/.test(u) },
  { p: 'Instant (page builder)', t: u => /instant\.so|instantcdn/.test(u) },
  { p: 'Locksmith', t: u => /locksmith|uselocksmith/.test(u) },
];
const OWN_HOSTS = new RegExp(`${ownDomains.length ? `(^|\\.)(${ownDomains.map(esc).join('|')})$|` : ''}cdn\\.shopify\\.com$|fonts\\.(googleapis|gstatic|shopifycdn)\\.com$|cdn\\.jsdelivr\\.net$`);
const TRACKY = /collect|track|pixel|event|analytic|beacon|telemetry|log|metric|\/tr\b|conversion|signal/i;

function gaEvents(u, body) {
  const out = [];
  const en = qp(u, 'en'); if (en) out.push(en);
  if (body) for (const line of String(body).split(/\r?\n/)) { const m = line.match(/(?:^|&)en=([^&]+)/); if (m) out.push(decodeURIComponent(m[1])); }
  return out;
}

function classify(url, body) {
  for (const r of RULES) {
    if (!r.t(url)) continue;
    const isHit = typeof r.hit === 'function' ? r.hit(url) : !!r.hit;
    let host = ''; try { host = new URL(url).hostname; } catch {}
    return { plataforma: r.p, interno: !!r.internal, id: r.id ? r.id(url, body) : null, eventos: r.ev ? r.ev(url, body) : [], hit: isHit, host };
  }
  let host = ''; try { host = new URL(url).hostname; } catch {}
  // GA4 por servidor propio (sGTM con dominio de la tienda) se detecta por /g/collect arriba.
  if (OWN_HOSTS.test(host)) return null;
  if (/^(data|blob|chrome-extension):/.test(url)) return null;
  return { plataforma: `Otro tercero (${host})`, otro: true, id: null, eventos: [], hit: TRACKY.test(url) };
}

// ---------- captura por URL ----------
async function capture(browser, rawUrl) {
  const url = withPreview(rawUrl);
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  // Meta/TikTok descartan hits de navegadores automatizados: UA normal y navigator.webdriver=false.
  const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
  await page.setUserAgent(ua);
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  if (args.mobile) await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });
  else await page.setViewport({ width: 1440, height: 900 });

  const reqs = new Map(); // key sessionLabel:requestId
  const sessions = new Set();
  const hook = async (cdp, label) => {
    if (sessions.has(cdp)) return; sessions.add(cdp);
    cdp.on('Network.requestWillBeSent', e => {
      const k = label + ':' + e.requestId;
      const prev = reqs.get(k);
      if (prev && e.redirectResponse) prev.redirected = true;
      reqs.set(k, { url: e.request.url, method: e.request.method, post: e.request.postData || (e.request.postDataEntries || []).map(x => x.bytes ? Buffer.from(x.bytes, 'base64').toString() : '').join('') || null, type: e.type, initiator: e.initiator?.url || e.initiator?.stack?.callFrames?.[0]?.url || null, frame: label, t: Date.now(), bytes: 0, status: null, phase: currentPhase });
    });
    cdp.on('Network.responseReceived', e => { const r = reqs.get(label + ':' + e.requestId); if (r) r.status = e.response.status; });
    cdp.on('Network.loadingFinished', e => { const r = reqs.get(label + ':' + e.requestId); if (r) r.bytes = e.encodedDataLength; });
    cdp.on('Network.loadingFailed', e => { const r = reqs.get(label + ':' + e.requestId); if (r) r.failed = e.errorText; });
    cdp.on('Target.attachedToTarget', async e => {
      // auto-attach recursivo (iframes OOPIF y workers de web pixels)
      try {
        const child = cdp.connection().session(e.sessionId);
        if (!child) return;
        await hook(child, e.targetInfo.type + ':' + e.targetInfo.url.slice(0, 80));
        await child.send('Network.enable').catch(() => {});
        await child.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
        await child.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }).catch(() => {});
        await child.send('Runtime.runIfWaitingForDebugger').catch(() => {});
      } catch {}
    });
    await cdp.send('Network.enable').catch(() => {});
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
    await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }).catch(() => {});
  };
  let currentPhase = 'carga';
  const cdp = await page.createCDPSession();
  await hook(cdp, 'page');
  await page.setCacheEnabled(false);

  const log = [];
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) { log.push('goto: ' + e.message); }
  await sleep(WAIT);

  currentPhase = 'scroll';
  await page.evaluate(async () => {
    const step = Math.max(400, innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); }
    scrollTo(0, 0);
  }).catch(e => log.push('scroll: ' + e.message));
  await sleep(3000);

  const isPdp = /\/products\//.test(url);
  if (isPdp && !args.noInteract) {
    currentPhase = 'variante';
    const v = await page.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const cands = [...document.querySelectorAll('[data-instant-action-type="select-variant-option"], variant-radios input[type=radio], input[type=radio][name*="ption"], [data-option-value], .swatch input')].filter(vis);
      const pick = cands.find(el => el.getAttribute('data-instant-state') !== 'active' && !el.checked) || cands[1] || cands[0];
      if (!pick) return null;
      pick.scrollIntoView({ block: 'center' });
      pick.click();
      return (pick.innerText || pick.value || pick.getAttribute('aria-label') || pick.outerHTML.slice(0, 80)).trim().slice(0, 60);
    }).catch(e => (log.push('variante: ' + e.message), null));
    log.push('variante clic: ' + (v ?? 'no encontrada'));
    await sleep(3000);

    currentPhase = 'add_to_cart';
    const atc = await page.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const sel = ['[data-instant-action-type="add-to-cart"]', 'form[action*="/cart/add"] [type=submit]', 'button[name="add"]', '[data-add-to-cart]', 'button.product-form__submit'];
      for (const s of sel) { const el = [...document.querySelectorAll(s)].find(vis); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return 'clic ' + s; } }
      const txt = [...document.querySelectorAll('button, a, [role=button]')].filter(vis).find(el => /agregar al carrito|añadir al carrito|add to cart/i.test(el.innerText || ''));
      if (txt) { txt.click(); return 'clic texto "' + txt.innerText.trim().slice(0, 40) + '"'; }
      return null;
    }).catch(e => (log.push('atc: ' + e.message), null));
    if (atc) log.push('add-to-cart: ' + atc);
    else if (args.atcCheckout) {
      const r = await page.evaluate(() => { const el = document.querySelector('[data-instant-action-type="redirect-to-checkout"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; } return false; });
      log.push('add-to-cart: sin botón de carrito; CTA "comprar ahora" (redirect-to-checkout) ' + (r ? 'pulsado' : 'no encontrado'));
      currentPhase = 'checkout';
    } else {
      const r = await page.evaluate(async () => {
        const id = window.ShopifyAnalytics?.meta?.selectedVariantId || window.ShopifyAnalytics?.meta?.product?.variants?.[0]?.id || new URLSearchParams(location.search).get('variant');
        if (!id) return 'sin variantId';
        const res = await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: Number(id), quantity: 1 }] }) });
        return 'POST /cart/add.js variante ' + id + ' → ' + res.status;
      }).catch(e => 'error ' + e.message);
      log.push('add-to-cart: sin botón de carrito en la PDP (el CTA va directo al checkout); se simuló con ' + r);
    }
    await sleep(WAIT);
  }

  // estado en página (IDs inicializados por cada librería)
  const runtime = await page.evaluate(() => {
    const o = {};
    try { o.google_tag_manager = Object.keys(window.google_tag_manager || {}).filter(k => /^(G|AW|GTM|GT|DC|MC)-/.test(k)); } catch {}
    try { o.dataLayerEvents = (window.dataLayer || []).map(x => x && (x.event || (x[0] === 'event' || x[0] === 'config' ? x[0] + ':' + x[1] : null))).filter(Boolean).slice(0, 60); } catch {}
    try { const st = window.fbq?.getState?.(); o.fbqPixels = st ? st.pixels.map(p => p.id) : (window.fbq ? ['(fbq presente)'] : []); } catch {}
    try { o.ttqPixels = window.ttq?._i ? Object.keys(window.ttq._i) : (window.ttq ? ['(ttq presente)'] : []); } catch {}
    try { o.klaviyo = !!(window.klaviyo || window._learnq); o.klaviyoCompany = window.klaviyo?.account?.() || null; } catch {}
    try { o.clarity = typeof window.clarity === 'function'; } catch {}
    try { o.intelligems = !!window.igData || !!window.Intelligems; } catch {}
    try { o.heatmap = !!window._heatmap_paq; } catch {}
    try { o.pintrk = !!window.pintrk; o.snaptr = !!window.snaptr; o.hj = !!window.hj; o.uetq = !!window.uetq; } catch {}
    try {
      const s = [...document.scripts].map(x => x.textContent).find(t => t.includes('webPixelsConfigList'));
      if (s) {
        const i = s.indexOf('webPixelsConfigList'); const j = s.indexOf('[', i); let d = 0, k = j;
        for (; k < s.length; k++) { if (s[k] === '[') d++; else if (s[k] === ']' && --d === 0) break; }
        o.webPixels = JSON.parse(s.slice(j, k + 1)).map(p => ({ id: p.id, type: p.type, name: p.name || null, apiClientId: p.apiClientId || null, runtimeContext: p.runtimeContext, configuration: p.configuration || null }));
      }
    } catch (e) { o.webPixelsError = String(e); }
    o.scripts = [...document.scripts].map(s => s.src).filter(Boolean);
    return o;
  }).catch(e => ({ error: e.message }));

  const finalUrl = page.url();
  await ctx.close();

  const requests = [...reqs.values()].map(r => ({ ...r, c: classify(r.url, r.post) }));
  return { url, finalUrl, log, runtime, requests };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- agregación ----------
function aggregate(pages) {
  const plat = {};
  for (const pg of pages) {
    const slug = slugOf(pg.url);
    for (const r of pg.requests) {
      if (!r.c) continue;
      const k = r.c.plataforma;
      const P = plat[k] ||= { plataforma: k, interno: !!r.c.interno, otro: !!r.c.otro, ids: {}, hosts: {}, contextos: {}, idsPorPagina: {}, paginas: {}, eventos: {}, requests: 0, bytes: 0, hits: 0, hitsFallidos: 0, ejemplos: [] };
      P.requests++; P.bytes += r.bytes || 0;
      P.paginas[slug] ||= { requests: 0, bytes: 0, hits: 0 };
      P.paginas[slug].requests++; P.paginas[slug].bytes += r.bytes || 0;
      if (r.c.id) { P.ids[r.c.id] = (P.ids[r.c.id] || 0) + 1; (P.idsPorPagina[slug] ||= {})[r.c.id] = ((P.idsPorPagina[slug] || {})[r.c.id] || 0) + 1; }
      if (r.c.host) P.hosts[r.c.host] = (P.hosts[r.c.host] || 0) + 1;
      const ctxName = r.frame === 'page' ? 'página' : (r.frame.startsWith('worker:') && /web-pixels/.test(r.frame) ? 'web-pixel (sandbox)' : r.frame.split(':')[0]);
      P.contextos[ctxName] = (P.contextos[ctxName] || 0) + 1;
      if (r.c.hit) {
        P.hits++; P.paginas[slug].hits++;
        if ((r.failed && !r.status) || (r.status && r.status >= 400)) P.hitsFallidos++; // sendBeacon sale como ERR_ABORTED con 204: es OK
        for (const e of r.c.eventos || []) { const ek = (r.c.id ? r.c.id + ' · ' : '') + e; P.eventos[ek] ||= {}; P.eventos[ek][slug] = (P.eventos[ek][slug] || 0) + 1; }
      }
      if (P.ejemplos.length < 6 && !P.ejemplos.some(x => x.split('?')[0] === r.url.split('?')[0])) P.ejemplos.push(r.url.slice(0, 220));
    }
  }
  return plat;
}
function slugOf(u) { const p = new URL(u).pathname.replace(/\/+$/, ''); return p === '' ? 'home' : p.split('/').filter(Boolean).join('_'); }

function compare(expected, plat, pages) {
  const missing = [], extra = [];
  const seen = new Set();
  // IDs inicializados en la página (aunque su script venga ofuscado, p. ej. GTM por dominio propio)
  for (const pg of pages) {
    const rt = pg.runtime || {};
    for (const id of rt.google_tag_manager || []) seen.add((id.startsWith('GTM-') ? 'Google Tag Manager' : 'Google tag (gtag.js)') + '|' + id);
    for (const id of rt.fbqPixels || []) seen.add('Meta Pixel|' + id);
    for (const id of rt.ttqPixels || []) seen.add('TikTok Pixel|' + id);
  }
  for (const P of Object.values(plat)) { seen.add(P.plataforma + '|'); for (const id of Object.keys(P.ids)) seen.add(P.plataforma + '|' + id); }
  const optionalMissing = [];
  for (const e of expected) {
    const key = e.plataforma + '|' + (e.id || '');
    if (!seen.has(key)) (e.opcional ? optionalMissing : missing).push(key);
  }
  const expKeys = new Set(expected.map(e => e.plataforma + '|' + (e.id || '')));
  const expPlats = new Set(expected.map(e => e.plataforma));
  const NO_MEDICION = /^(Instant|Revie|Smind|EG Auto|Hulk|Locksmith|GeoJS|Shopify \(Shop Pay|Google \(DoubleClick|Otro tercero)/;
  for (const k of seen) {
    const [plat, id] = k.split('|');
    if (expKeys.has(k) || NO_MEDICION.test(plat)) continue;
    if (!id && expPlats.has(plat)) continue; // plataforma conocida sin ID en esta request
    extra.push(k);
  }
  return { missing, optionalMissing, extra };
}

// ---------- main ----------
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: args.headful ? false : 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--lang=es-CO', '--disable-blink-features=AutomationControlled'],
});
const pages = [];
try {
  for (const u of args.url) {
    process.stderr.write(`→ ${withPreview(u)}\n`);
    const r = await capture(browser, u);
    process.stderr.write(`  ${r.requests.length} requests · ${r.log.join(' | ')}\n`);
    pages.push(r);
  }
} finally { await browser.close(); }

const plat = aggregate(pages);
const result = {
  generado: new Date().toISOString(),
  previewThemeId: args.previewThemeId || null,
  paginas: pages.map(p => ({ url: p.url, finalUrl: p.finalUrl, log: p.log, runtime: p.runtime, totalRequests: p.requests.length, totalBytes: p.requests.reduce((s, r) => s + (r.bytes || 0), 0) })),
  plataformas: plat,
  ...(args.keepRaw ? { raw: pages.map(p => ({ url: p.url, requests: p.requests.map(r => ({ url: r.url, method: r.method, status: r.status, bytes: r.bytes, frame: r.frame, phase: r.phase, initiator: r.initiator, failed: r.failed || null, post: r.post ? r.post.slice(0, 1500) : null, plataforma: r.c?.plataforma || null })) })) } : {}),
};

// resumen consola
const rows = Object.values(plat).sort((a, b) => b.bytes - a.bytes);
console.log('\nPlataforma'.padEnd(42) + 'IDs'.padEnd(40) + 'req'.padStart(5) + 'KB'.padStart(8) + 'hits'.padStart(6));
for (const P of rows) console.log(P.plataforma.slice(0, 40).padEnd(41) + Object.keys(P.ids).join(',').slice(0, 39).padEnd(40) + String(P.requests).padStart(5) + (P.bytes / 1024).toFixed(1).padStart(8) + String(P.hits).padStart(6));

if (args.saveExpect && args.saveExpect !== true) {
  const NO_MEDICION = /^(Instant|Revie|Smind|EG Auto|Hulk|Locksmith|GeoJS|Shopify|Google \(DoubleClick|Otro tercero|Mercado Pago|Boostmark|Tolstoy|Clipara)/;
  const esperados = [];
  for (const P of Object.values(plat)) {
    if (P.interno || P.otro || NO_MEDICION.test(P.plataforma)) continue;
    const ids = Object.keys(P.ids);
    if (!ids.length) esperados.push({ plataforma: P.plataforma });
    for (const id of ids) esperados.push({ plataforma: P.plataforma, id });
  }
  const doc = {
    generado: new Date().toISOString(), urls: args.url, previewThemeId: args.previewThemeId || null,
    fuente: 'scripts/pixel-check.mjs --save-expect (revisar a mano: marcar "opcional": true lo que no es obligatorio y cruzar con CONSTRAINTS.md)',
    uso_qa_gate: 'node <toolkit>/scripts/pixel-check.mjs --preview --expect data/tags.json  → exit 1 si falta un tag esperado',
    esperados,
  };
  mkdirSync(dirname(resolve(args.saveExpect)), { recursive: true });
  writeFileSync(args.saveExpect, JSON.stringify(doc, null, 2) + '\n');
  console.log(`\nEsperados (${esperados.length}) → ${args.saveExpect}`);
}
let exit = 0;
if (args.expect && args.expect !== true) {
  if (!existsSync(args.expect)) { console.error(`No existe ${args.expect}: genéralo desde el live con --save-expect ${args.expect}`); process.exit(2); }
  const exp = JSON.parse(readFileSync(args.expect, 'utf8'));
  const list = exp.esperados || exp;
  const cmp = compare(list, plat, pages);
  result.comparacion = cmp;
  console.log('\nComparación contra ' + args.expect + ':');
  console.log('  Faltan: ' + (cmp.missing.length ? cmp.missing.join(', ') : 'ninguno'));
  console.log('  Opcionales ausentes (avisar): ' + (cmp.optionalMissing.length ? cmp.optionalMissing.join(', ') : 'ninguno'));
  console.log('  Nuevos (avisar): ' + (cmp.extra.length ? cmp.extra.join(', ') : 'ninguno'));
  if (cmp.missing.length) exit = 1;
}
if (args.out && args.out !== true) {
  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  writeFileSync(args.out, JSON.stringify(result, null, 2));
  console.log('\nGuardado: ' + args.out);
}
process.exit(exit);
