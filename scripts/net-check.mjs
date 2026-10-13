#!/usr/bin/env node
// net-check.mjs — verificación rápida de red de UNA página en móvil, sin el MCP (para confirmar fixes).
//
// Uso (desde la carpeta del proyecto):
//   node <toolkit>/scripts/net-check.mjs --page pdp --preview --pattern 'FUNNEL14|hero'
//   node <toolkit>/scripts/net-check.mjs --url URL [--preview-theme-id ID] --summary
//   Flags: --page home|pdp|collection (URL del .env) | --url URL · --preview (= WORK_THEME_ID) |
//          --preview-theme-id ID · --pattern REGEX (lista requests que matchean, con prioridad inicial
//          y final) · --summary (bytes por tipo + top 15 más pesados) · --scroll (scroll completo antes
//          de cerrar) · --wait ms (extra tras load, default 3000) · --json archivo.json · --chrome RUTA
//
// Emulación: 412×915, DPR 2.625, UA Android, caché deshabilitada, perfil temporal limpio. Sin
// throttling: sirve para ver QUÉ se pide y con qué prioridad/peso, no para medir ms (eso es el
// trace con la metodología fija de la sección 2 del SOP).
// En preview: primero GET /robots.txt?preview_theme_id=ID (fija la cookie) y se verifica Shopify.theme.id.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { parseArgsMulti, str, projectEnv, findChrome, withPreview, fmtBytes, printTable } from './theme-lib.mjs';

const args = parseArgsMulti(process.argv.slice(2));
if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const env = projectEnv();
const PAGE_KEYS = { home: 'HOME_URL', pdp: 'PDP_URL', collection: 'COLLECTION_URL' };
const url = str(args.url) || (str(args.page) && env[PAGE_KEYS[args.page]]) || (!args.page ? env.HOME_URL : null);
const themeId = str(args['preview-theme-id']) || (args.preview ? env.WORK_THEME_ID : null);
if (!url || (!args.pattern && !args.summary)) {
  console.error('Uso: --url URL | --page home|pdp|collection   y   --pattern REGEX y/o --summary   [--preview | --preview-theme-id ID] [--scroll] [--wait ms] [--json f.json]');
  process.exit(2);
}
if (args.preview && !themeId) { console.error('--preview requiere WORK_THEME_ID en .env'); process.exit(2); }
const pattern = str(args.pattern) ? new RegExp(args.pattern, 'i') : null;
const WAIT = Number(args.wait || 3000);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const browser = await puppeteer.launch({
  executablePath: findChrome(args.chrome), headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-blink-features=AutomationControlled'],
});
let result;
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await page.setCacheEnabled(false);
  const origin = new URL(url).origin;
  if (themeId) await page.goto(`${origin}/robots.txt?preview_theme_id=${themeId}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});

  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const reqs = new Map();
  const t0 = Date.now();
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.redirectResponse && reqs.has(e.requestId)) reqs.get(e.requestId).redirected = true;
    reqs.set(e.requestId, {
      url: e.request.url, type: e.type || 'Other', initialPriority: e.request.initialPriority, priority: e.request.initialPriority,
      t: Date.now() - t0, status: null, bytes: 0, mime: null, failed: null,
    });
  });
  cdp.on('Network.resourceChangedPriority', (e) => { const r = reqs.get(e.requestId); if (r) r.priority = e.newPriority; });
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.type = e.type || r.type; } });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) r.failed = e.errorText; });

  const target = themeId ? withPreview(url, themeId) : url;
  console.error(`→ ${target}`);
  await page.goto(target, { waitUntil: 'load', timeout: 120000 });
  await new Promise((r) => setTimeout(r, WAIT));
  if (args.scroll) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
      scrollTo(0, 0);
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }
  const theme = await page.evaluate(() => (window.Shopify && window.Shopify.theme ? { id: window.Shopify.theme.id, name: window.Shopify.theme.name, role: window.Shopify.theme.role } : null)).catch(() => null);
  const lcpCandidates = await page.evaluate(() => [...document.querySelectorAll('img[fetchpriority="high"], link[rel="preload"]')].slice(0, 10).map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute('fetchpriority') ? `fetchpriority=${el.getAttribute('fetchpriority')} ` : ''}${(el.currentSrc || el.href || el.src || '').slice(0, 140)}`)).catch(() => []);
  await ctx.close();
  result = { url: target, theme, lcpCandidates, requests: [...reqs.values()] };
} finally {
  await browser.close();
}

const { requests, theme } = result;
const short = (u) => {
  try {
    const x = new URL(u);
    const p = x.pathname.length > 64 ? `/…${x.pathname.slice(-62)}` : x.pathname; // el nombre de archivo es lo que importa
    return x.hostname + p + (x.search ? `?${x.search.slice(1, 30)}` : '');
  } catch { return u.slice(0, 110); }
};
console.log(`\nTema servido: ${theme ? `${theme.id} · ${theme.name} · ${theme.role}` : '(sin Shopify.theme)'}${themeId && theme && String(theme.id) !== String(themeId) ? `  ⚠️  NO es el preview ${themeId}` : ''}`);
console.log(`Requests: ${requests.length} · transferido: ${fmtBytes(requests.reduce((s, r) => s + (r.bytes || 0), 0))}`);

if (pattern) {
  const hits = requests.filter((r) => pattern.test(r.url));
  console.log(`\nMatchean /${args.pattern}/ (${hits.length}):`);
  if (hits.length) {
    printTable(['t ms', 'tipo', 'prio inicial', 'prio final', 'status', 'peso', 'url'],
      hits.map((r) => [r.t, r.type, r.initialPriority, r.priority !== r.initialPriority ? r.priority : '=', r.status ?? (r.failed || '—'), fmtBytes(r.bytes), short(r.url)]));
  }
  if (result.lcpCandidates.length) { console.log('\nfetchpriority=high / preloads en el DOM:'); result.lcpCandidates.forEach((l) => console.log(`  ${l}`)); }
}

if (args.summary) {
  const byType = {};
  for (const r of requests) { const t = (byType[r.type] ||= { n: 0, bytes: 0 }); t.n++; t.bytes += r.bytes || 0; }
  const total = requests.reduce((s, r) => s + (r.bytes || 0), 0) || 1;
  console.log('\nBytes por tipo:');
  printTable(['tipo', 'requests', 'peso', '%'], Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes)
    .map(([t, v]) => [t, v.n, fmtBytes(v.bytes), `${Math.round((v.bytes / total) * 100)}%`]));
  console.log('\nTop 15 más pesados:');
  printTable(['peso', 'tipo', 'prio', 'url'], [...requests].sort((a, b) => b.bytes - a.bytes).slice(0, 15)
    .map((r) => [fmtBytes(r.bytes), r.type, r.initialPriority, short(r.url)]));
}

if (str(args.json)) {
  mkdirSync(dirname(resolve(args.json)), { recursive: true });
  writeFileSync(args.json, JSON.stringify({ generado: new Date().toISOString(), ...result }, null, 2) + '\n');
  console.log(`\nGuardado: ${args.json}`);
}
