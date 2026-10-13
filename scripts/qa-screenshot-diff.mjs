#!/usr/bin/env node
// qa-screenshot-diff.mjs — wrapper estabilizado de perf-toolkit/scripts/screenshot-diff.mjs (QA Gate 6.5, Lummia).
//
// Diferencias con el script del toolkit:
//  - Cada captura en un contexto de navegador NUEVO: el script del toolkit reutiliza el navegador y la cookie
//    de preview_theme_id se queda pegada, así que su captura "live" de desktop sale en realidad del preview.
//    Aquí se verifica Shopify.theme.id de cada captura y se aborta si no coincide.
//  - Estabiliza por igual en ambos lados: oculta popups Klaviyo / overlays fijos / barra de preview de Shopify,
//    oculta <video> e iframes de video (visibility:hidden, conserva la caja), detiene y resetea carruseles
//    (Swiper, Flickity, Slick, Splide), congela animaciones, espera fuentes e imágenes.
//  - Además del diff full-page, genera recortes live|preview|diff por cada franja vertical con diferencias
//    (bands/) para revisarlas a ojo.
//
// Uso: node tools/qa-screenshot-diff.mjs --live URL --preview URL --out data/qa/<nombre>/ [--theme-live ID --theme-preview ID]

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const TK = process.env.PERF_TOOLKIT || '/Users/andrey/Desktop/Develop/ConvertMate/perf-toolkit';
const { default: puppeteer } = await import(join(TK, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'));
const { default: pixelmatch } = await import(join(TK, 'node_modules/pixelmatch/index.js'));
const { PNG } = (await import(join(TK, 'node_modules/pngjs/lib/png.js'))).default;

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k.startsWith('--')) { const n = process.argv[i + 1]; args[k.slice(2)] = n && !n.startsWith('--') ? (i++, n) : true; }
}
if (!args.live || !args.preview || !args.out) { console.error('Uso: --live URL --preview URL --out dir/'); process.exit(2); }
const THEME_LIVE = String(args['theme-live'] || ''); // ID del tema live (opcional: si se pasa, se verifica en cada captura)
const THEME_PREVIEW = String(args['theme-preview'] || new URL(args.preview).searchParams.get('preview_theme_id') || '');
const UMBRAL = 1;
const VIEWPORTS = {
  mobile: { width: 412, height: 915, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
};
const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STABILIZE_CSS = `
*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
video, iframe[src*="tolstoy"], iframe[src*="youtube"], iframe[src*="vimeo"], .tolstoy-stories, tolstoy-carousel { visibility: hidden !important; }
#preview-bar-iframe, #PBarNextFrameWrapper, #PBarNextFrame, .needsclick.kl-private-reset-css-Xuajs1[role="dialog"],
div[aria-label="POPUP Form"], div[aria-label*="Popup"], .klaviyo-form[data-testid="POPUP"], .kl-teaser, [data-testid="animated-teaser"] { display: none !important; }
html { scroll-behavior: auto !important; }
`;

async function stabilize(page) {
  await page.addStyleTag({ content: STABILIZE_CSS });
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => { try { v.pause(); v.currentTime = 0; } catch {} });
    // overlays fijos grandes (popups) — se ocultan; el header fijo no cubre >35% del viewport
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > innerWidth * innerHeight * 0.35 && cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('header')) el.style.setProperty('display', 'none', 'important');
    }
    try { document.querySelectorAll('.swiper, .swiper-container, swiper-container').forEach((s) => { const sw = s.swiper; if (sw) { sw.autoplay?.stop?.(); sw.slideTo?.(sw.params?.loop ? sw.loopedSlides || 0 : 0, 0, false); } }); } catch {}
    try { if (window.Flickity) document.querySelectorAll('.flickity-enabled').forEach((el) => { const f = window.Flickity.data(el); if (f) { f.stopPlayer(); f.select(0, false, true); } }); } catch {}
    try { if (window.jQuery) window.jQuery('.slick-initialized').each(function () { window.jQuery(this).slick('slickPause').slick('slickGoTo', 0, true); }); } catch {}
    try { document.querySelectorAll('.splide').forEach((el) => { const s = el.splide; if (s) { s.Components?.Autoplay?.pause(); s.go(0); } }); } catch {}
  }).catch(() => {});
}

async function capturar(browser, url, viewport, expectTheme) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
    const theme = await page.evaluate(() => String(window.Shopify?.theme?.id || ''));
    if (expectTheme && theme !== expectTheme) throw new Error(`tema renderizado ${theme} ≠ esperado ${expectTheme}`);
    await stabilize(page);
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
      scrollTo(0, 0);
    });
    await sleep(2500);
    await stabilize(page); // los popups/carruseles que aparecieron durante el scroll
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); })));
    });
    await sleep(800);
    const buf = await page.screenshot({ fullPage: true, type: 'png', captureBeyondViewport: true });
    return { png: PNG.sync.read(Buffer.from(buf)), theme };
  } finally { await ctx.close(); }
}

function igualar(a, b) {
  const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height);
  const pad = (img) => { if (img.width === width && img.height === height) return img; const o = new PNG({ width, height }); o.data.fill(255); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; };
  return [pad(a), pad(b), width, height];
}

// franjas verticales con diferencias (filas con >0.5% de píxeles distintos, unidas si están a <60 px)
function franjas(diff, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) n++; }
    rows.push(n / width);
  }
  const bands = []; let cur = null;
  rows.forEach((r, y) => {
    if (r > 0.005) { if (cur && y - cur.y1 < 60) { cur.y1 = y; cur.px += r * width; } else { cur = { y0: y, y1: y, px: r * width }; bands.push(cur); } }
  });
  return bands.filter((b) => b.px > 150);
}

function crop(img, y0, y1) {
  const h = y1 - y0, o = new PNG({ width: img.width, height: h });
  PNG.bitblt(img, o, 0, y0, img.width, h, 0, 0); return o;
}
function sideBySide(imgs) {
  const gap = 12, w = imgs.reduce((s, i) => s + i.width, 0) + gap * (imgs.length - 1), h = Math.max(...imgs.map((i) => i.height));
  const o = new PNG({ width: w, height: h }); o.data.fill(0); for (let i = 3; i < o.data.length; i += 4) o.data[i] = 255;
  let x = 0; for (const i of imgs) { PNG.bitblt(i, o, 0, 0, i.width, i.height, x, 0); x += i.width + gap; }
  return o;
}

const outDir = resolve(process.cwd(), args.out);
mkdirSync(join(outDir, 'bands'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--lang=es-CO', '--hide-scrollbars'] });
const resumen = [];
try {
  for (const [nombre, vp] of Object.entries(VIEWPORTS)) {
    let L, P;
    try {
      L = await capturar(browser, args.live, vp, THEME_LIVE);
      P = await capturar(browser, args.preview, vp, THEME_PREVIEW);
    } catch (e) { console.log(`ERROR ${nombre}: ${e.message}`); resumen.push({ nombre, error: e.message }); continue; }
    const [a, b, width, height] = igualar(L.png, P.png);
    const diff = new PNG({ width, height });
    const n = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
    const pct = (n / (width * height)) * 100;
    writeFileSync(join(outDir, `${nombre}-live.png`), PNG.sync.write(a));
    writeFileSync(join(outDir, `${nombre}-preview.png`), PNG.sync.write(b));
    writeFileSync(join(outDir, `${nombre}-diff.png`), PNG.sync.write(diff));
    const bands = franjas(diff, width, height);
    const maxH = nombre === 'mobile' ? 1400 : 1000;
    bands.forEach((bd, i) => {
      const y0 = Math.max(0, bd.y0 - 40), y1 = Math.min(height, Math.max(bd.y1 + 40, y0 + 80), y0 + maxH);
      writeFileSync(join(outDir, 'bands', `${nombre}-band${String(i + 1).padStart(2, '0')}-y${y0}.png`), PNG.sync.write(sideBySide([crop(a, y0, y1), crop(b, y0, y1), crop(diff, y0, y1)])));
    });
    resumen.push({ nombre, pct, alturaLive: L.png.height, alturaPreview: P.png.height, temaLive: L.theme, temaPreview: P.theme, franjas: bands.map((bd) => ({ y0: bd.y0, y1: bd.y1, px: Math.round(bd.px) })) });
  }
} finally { await browser.close(); }

writeFileSync(join(outDir, 'resumen.json'), JSON.stringify({ live: args.live, preview: args.preview, resumen }, null, 2));
let alerta = false;
for (const r of resumen) {
  if (r.error) { console.log(`  ERROR ${r.nombre}: ${r.error}`); alerta = true; continue; }
  if (r.pct > UMBRAL) alerta = true;
  console.log(`  ${r.pct > UMBRAL ? 'ALERTA' : 'ok    '} ${r.nombre.padEnd(8)} ${r.pct.toFixed(2)}%  alto live ${r.alturaLive} / preview ${r.alturaPreview}  temas ${r.temaLive}/${r.temaPreview}  franjas: ${r.franjas.map((f) => `${f.y0}-${f.y1}`).join(', ') || '—'}`);
}
process.exit(alerta ? 1 : 0);
