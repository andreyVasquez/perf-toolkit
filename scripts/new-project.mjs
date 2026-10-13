#!/usr/bin/env node
// new-project.mjs — arranca una ronda de velocidad: pasos 1-2 del SOP en un comando.
//
// Uso:
//   node scripts/new-project.mjs --marca "X" --store x.myshopify.com \
//     --home URL --pdp URL --collection URL [--dir ~/Desktop/Develop/ConvertMate/<slug>] \
//     [--dry-run] [--force] [--no-push] [--detect-only]
//
// Qué hace (idempotente: cada paso se salta si ya está hecho):
//   1. Carpeta del proyecto + .env (SHOPIFY_STORE, URLs, CRUX_API_KEY/TINYPNG_API_KEY copiadas del
//      .env del toolkit si existen, WORK_THEME_ID) + .gitignore + CONSTRAINTS.md desde templates/.
//   2. mkdir theme + `shopify theme pull --live` (si theme/ ya tiene archivos: no re-pull sin --force).
//   3. Zip de respaldo backup-live-AAAA-MM-DD.zip.
//   4. git init + commit "live baseline AAAA-MM-DD" + tag baseline-AAAA-MM-DD + rama perf/AAAA-MM.
//   5. `shopify theme push --unpublished --theme "[CM] Perf AAAAMM" --json` → WORK_THEME_ID al .env
//      (los errores de templates que reporte el push se listan como "preexistentes en live").
//   6. Agrega la marca a stores.json del toolkit si no existe.
//   7. Detección del tipo de tienda → consola + data/tienda.json: % de secciones de page builders
//      (instant-*, gp-*, gem-*) en los templates de home/PDP/colección (template real de la PDP
//      vía <pdp>.json o el HTML), schema_name del tema y app embeds encendidos/apagados.
//
// --dry-run: no crea, no descarga ni sube nada; muestra lo que haría (la detección corre si ya hay theme/).
// --detect-only: solo el paso 7 sobre una carpeta existente (lectura + GET públicos).
// --no-push: no crea el duplicado (pasos 1-4, 6, 7).
// --force: re-pull del live aunque theme/ exista, y nuevo duplicado aunque haya WORK_THEME_ID.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import {
  TOOLKIT_ROOT, parseArgsMulti, str, readEnvFile, setEnvVar, run, runLive, showCmd, git,
  parseJsonLoose, readThemeJson, fechas, slugify, printTable, withPreview,
} from './theme-lib.mjs';

const args = parseArgsMulti(process.argv.slice(2));
if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const dry = Boolean(args['dry-run']);
const force = Boolean(args.force);
const F = fechas();

const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const marca = str(args.marca);
let dir = str(args.dir) ? resolve(expandHome(args.dir)) : (marca ? join(homedir(), 'Desktop/Develop/ConvertMate', slugify(marca)) : null);

// En --detect-only los datos salen del .env de la carpeta si no vienen por flag.
const envPath = dir ? join(dir, '.env') : null;
const prevEnv = envPath ? readEnvFile(envPath) : {};
const store = normalizeStore(str(args.store) || prevEnv.SHOPIFY_STORE);
const urls = {
  home: str(args.home) || prevEnv.HOME_URL,
  pdp: str(args.pdp) || prevEnv.PDP_URL,
  collection: str(args.collection) || prevEnv.COLLECTION_URL,
};

if (!dir || !store || !urls.home || !urls.pdp || !urls.collection) {
  console.error('Uso: node scripts/new-project.mjs --marca "X" --store x.myshopify.com --home URL --pdp URL --collection URL [--dir DIR] [--dry-run] [--force] [--no-push] [--detect-only]');
  process.exit(1);
}
for (const [k, u] of Object.entries(urls)) {
  try { new URL(u); } catch { console.error(`--${k} no es una URL válida: ${u}`); process.exit(1); }
}

function normalizeStore(s) {
  if (!s) return null;
  const h = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return h.includes('.') ? h : `${h}.myshopify.com`;
}

const themeDir = join(dir, 'theme');
const log = [];
const step = (msg) => { console.log(`\n▸ ${msg}`); };
const did = (msg) => { log.push(msg); console.log(`  ${dry ? '[dry-run] ' : ''}${msg}`); };
const themeHasFiles = () => existsSync(join(themeDir, 'layout')) && readdirSync(join(themeDir, 'layout')).length > 0;

console.log(`Nuevo proyecto · ${marca || '(sin --marca)'} · ${store}\nCarpeta: ${dir}${dry ? '\n⚠️  DRY-RUN: no se crea, descarga ni sube nada.' : ''}`);

let workThemeId = prevEnv.WORK_THEME_ID || null;
let pushErrores = [];
let previewUrl = workThemeId ? withPreview(urls.home, workThemeId) : null;

if (!args['detect-only']) {
  // ---------- 1. carpeta, .env, .gitignore, CONSTRAINTS ----------
  step('Carpeta y archivos base');
  if (!existsSync(dir)) { if (!dry) mkdirSync(dir, { recursive: true }); did(`mkdir ${dir}`); }
  else did('carpeta ya existe');

  const toolkitEnv = readEnvFile(join(TOOLKIT_ROOT, '.env'));
  const wanted = {
    SHOPIFY_STORE: store, HOME_URL: urls.home, PDP_URL: urls.pdp, COLLECTION_URL: urls.collection,
    CRUX_API_KEY: prevEnv.CRUX_API_KEY || toolkitEnv.CRUX_API_KEY || process.env.CRUX_API_KEY || '',
    TINYPNG_API_KEY: prevEnv.TINYPNG_API_KEY || toolkitEnv.TINYPNG_API_KEY || process.env.TINYPNG_API_KEY || '',
    WORK_THEME_ID: prevEnv.WORK_THEME_ID || '',
  };
  if (!existsSync(envPath)) {
    const txt = `SHOPIFY_STORE=${wanted.SHOPIFY_STORE}\n\nHOME_URL=${wanted.HOME_URL}\nPDP_URL=${wanted.PDP_URL}\nCOLLECTION_URL=${wanted.COLLECTION_URL}\n\nCRUX_API_KEY=${wanted.CRUX_API_KEY}\nTINYPNG_API_KEY=${wanted.TINYPNG_API_KEY}\n\nWORK_THEME_ID=\n`;
    if (!dry) writeFileSync(envPath, txt);
    did(`.env creado (CRUX_API_KEY ${wanted.CRUX_API_KEY ? 'copiada del toolkit' : 'VACÍA'}, TINYPNG_API_KEY ${wanted.TINYPNG_API_KEY ? 'copiada' : 'vacía'})`);
  } else {
    const changed = [];
    for (const [k, v] of Object.entries(wanted)) {
      if (k === 'WORK_THEME_ID') continue;
      if (v && prevEnv[k] !== v && (!prevEnv[k] || ['HOME_URL', 'PDP_URL', 'COLLECTION_URL', 'SHOPIFY_STORE'].includes(k))) {
        if (!dry) setEnvVar(envPath, k, v);
        changed.push(k);
      }
    }
    did(changed.length ? `.env existente: actualizado ${changed.join(', ')}` : '.env existente sin cambios');
  }

  const GITIGNORE = ['.env', '*.zip', 'node_modules/', '.DS_Store', 'data/traces/', 'assets-src/'];
  const giPath = join(dir, '.gitignore');
  const giPrev = existsSync(giPath) ? readFileSync(giPath, 'utf8').split('\n').map((l) => l.trim()) : [];
  const giMissing = GITIGNORE.filter((l) => !giPrev.includes(l));
  if (giMissing.length) {
    if (!dry) writeFileSync(giPath, [...giPrev.filter(Boolean), ...giMissing].join('\n') + '\n');
    did(`.gitignore: ${giMissing.join(' ')}`);
  } else did('.gitignore ya completo');

  const cPath = join(dir, 'CONSTRAINTS.md');
  if (!existsSync(cPath)) {
    if (!dry) {
      const tpl = readFileSync(join(TOOLKIT_ROOT, 'templates/CONSTRAINTS.md'), 'utf8')
        .replace(/^\*\*Marca:\*\* PENDIENTE/m, `**Marca:** ${marca || 'PENDIENTE'}`);
      writeFileSync(cPath, tpl);
    }
    did('CONSTRAINTS.md desde templates/ (llenar con el cliente: GATING del Paso 4)');
  } else did('CONSTRAINTS.md ya existe (no se toca)');
  if (!dry) mkdirSync(join(dir, 'data'), { recursive: true });

  // ---------- 2. pull del live ----------
  step('Pull del tema live');
  if (themeHasFiles() && !force) {
    did('theme/ ya tiene archivos → no se re-descarga (usa --force para re-pull)');
  } else {
    const a = ['theme', 'pull', '--store', store, '--live', '--path', themeDir];
    if (dry) did(`mkdir -p theme && ${showCmd('shopify', a)}`);
    else {
      mkdirSync(themeDir, { recursive: true }); // el CLI falla si --path no existe
      console.log(`  $ ${showCmd('shopify', a)}`);
      const code = runLive('shopify', a);
      if (code !== 0 || !themeHasFiles()) { console.error('✖ theme pull falló. Revisa login (`shopify theme list --store ...`).'); process.exit(1); }
      did(`pull OK (${countFiles(themeDir)} archivos)`);
    }
  }

  // ---------- 3. zip de respaldo ----------
  step('Zip de respaldo');
  const zipName = `backup-live-${F.iso}.zip`;
  const existingZip = existsSync(dir) ? readdirSync(dir).find((f) => /^backup-live-\d{4}-\d{2}-\d{2}\.zip$/.test(f)) : null;
  if (existingZip && !force) did(`ya existe ${existingZip}`);
  else if (dry) did(`(cd theme && zip -rq ../${zipName} .)`);
  else {
    const r = run('zip', ['-rq', join(dir, zipName), '.'], { cwd: themeDir });
    if (r.code !== 0) { console.error(`✖ zip falló: ${r.stderr}`); process.exit(1); }
    did(`${zipName} creado`);
  }

  // ---------- 4. git ----------
  step('Git local (no conectado a la tienda)');
  const tag = `baseline-${F.iso}`;
  const branch = `perf/${F.ym}`;
  if (existsSync(join(dir, '.git'))) {
    const tags = git(['tag', '--list', 'baseline-*'], dir).stdout.trim();
    const cur = git(['rev-parse', '--abbrev-ref', 'HEAD'], dir).stdout.trim();
    did(`repo ya existe · rama ${cur} · tags baseline: ${tags.replace(/\n/g, ', ') || '(ninguno)'}`);
    if (!tags) console.log('  ⚠️  sin tag baseline-*: push-changed.mjs lo necesita (o usa --since <ref>).');
  } else if (dry) {
    did(`git init -b main && git add -A && git commit -m "live baseline ${F.iso}" && git tag ${tag} && git checkout -b ${branch}`);
  } else {
    const steps = [['init', '-q', '-b', 'main'], ['add', '-A'], ['commit', '-q', '-m', `live baseline ${F.iso}`], ['tag', tag], ['checkout', '-q', '-b', branch]];
    for (const s of steps) {
      const r = git(s, dir);
      if (r.code !== 0) { console.error(`✖ git ${s.join(' ')}: ${r.stderr}`); process.exit(1); }
    }
    did(`commit "live baseline ${F.iso}" · tag ${tag} · rama ${branch}`);
  }

  // ---------- 5. duplicado despublicado ----------
  step('Duplicado despublicado');
  const themeName = str(args['theme-name']) || `[CM] Perf ${F.ymCompact}`;
  if (args['no-push']) did('--no-push: no se crea duplicado');
  else if (workThemeId && !force) did(`WORK_THEME_ID=${workThemeId} ya en .env → no se crea otro (usa --force)`);
  else {
    const a = ['theme', 'push', '--store', store, '--unpublished', '--theme', themeName, '--path', themeDir, '--json'];
    if (dry) did(showCmd('shopify', a));
    else {
      console.log(`  $ ${showCmd('shopify', a)}  (puede tardar varios minutos)`);
      const r = run('shopify', a);
      const json = parseJsonLoose(r.stdout) || parseJsonLoose(r.stderr);
      const theme = json?.theme;
      pushErrores = extractPushErrors(json, r.stdout + '\n' + r.stderr);
      if (!theme?.id) {
        console.error(`✖ push --unpublished no devolvió un tema (exit ${r.code}).\n${(r.stderr || r.stdout).slice(-3000)}`);
        process.exit(1);
      }
      workThemeId = String(theme.id);
      previewUrl = withPreview(urls.home, workThemeId);
      setEnvVar(envPath, 'WORK_THEME_ID', workThemeId);
      did(`"${theme.name}" · ID ${workThemeId} → WORK_THEME_ID en .env${r.code ? ` (exit ${r.code} por errores de archivos)` : ''}`);
      if (theme.editor_url) did(`editor: ${theme.editor_url}`);
      if (pushErrores.length) {
        console.log(`  ⚠️  ${pushErrores.length} errores reportados por el push — PREEXISTENTES EN LIVE (vienen del pull del live, no de cambios nuestros):`);
        for (const e of pushErrores.slice(0, 30)) console.log(`     · ${e}`);
        if (!dry) writeFileSync(join(dir, 'data/push-errores-preexistentes.json'), JSON.stringify(pushErrores, null, 2) + '\n');
      }
    }
  }

  // ---------- 6. stores.json ----------
  step('stores.json del toolkit');
  if (!marca) did('sin --marca: no se agrega');
  else {
    const sPath = join(TOOLKIT_ROOT, 'stores.json');
    const stores = JSON.parse(readFileSync(sPath, 'utf8'));
    if (stores.some((s) => s.marca?.toLowerCase() === marca.toLowerCase())) did(`"${marca}" ya está`);
    else {
      stores.push({ marca, dominio: new URL(urls.home).origin, home: urls.home, pdp: urls.pdp, collection: urls.collection });
      if (!dry) writeFileSync(sPath, JSON.stringify(stores, null, 2) + '\n');
      did(`"${marca}" agregada (commitea stores.json en el toolkit)`);
    }
  }
}

// ---------- 7. detección del tipo de tienda ----------
function countFiles(d) {
  let n = 0;
  for (const e of readdirSync(d, { withFileTypes: true })) n += e.isDirectory() ? countFiles(join(d, e.name)) : 1;
  return n;
}

// Errores del push: los objetos JSON del CLI varían por versión; se aceptan varias formas + líneas de texto.
function extractPushErrors(json, text) {
  const out = new Set();
  const visit = (v, key) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (typeof v === 'object') {
      if ((v.key || v.file || v.filename) && (v.message || v.messages || v.errors)) {
        const msgs = [].concat(v.message || v.messages || v.errors).map((m) => (typeof m === 'string' ? m : JSON.stringify(m)));
        out.add(`${v.key || v.file || v.filename}: ${msgs.join(' | ')}`);
      } else for (const [k, x] of Object.entries(v)) if (k !== 'theme') visit(x, k);
    } else if (typeof v === 'string' && /error/i.test(key || '')) out.add(v);
  };
  if (json) visit(json);
  for (const line of String(text).split('\n')) {
    const l = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (/^(templates|sections|snippets|layout|config|assets|locales|blocks)\/\S+/.test(l) && /error|invalid|fail/i.test(l)) out.add(l);
  }
  return [...out];
}

function templateFor(kind, suffix) {
  const base = suffix ? `${kind}.${suffix}` : kind;
  for (const ext of ['json', 'liquid']) {
    const p = join(themeDir, 'templates', `${base}.${ext}`);
    if (existsSync(p)) return { name: `${base}.${ext}`, path: p };
  }
  return { name: `${base}.json`, path: null };
}

async function realTemplate(kind, url) {
  // 1) <url>.json (productos lo exponen con template_suffix); 2) HTML: "template":"product.xxx"
  try {
    const u = new URL(url); u.pathname = u.pathname.replace(/\/$/, '') + '.json'; u.search = '';
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    if (r.ok) {
      const j = await r.json();
      const obj = j[kind] || j.product || j.collection;
      if (obj && 'template_suffix' in obj) return { suffix: obj.template_suffix || '', via: `${u.pathname}` };
    }
  } catch { /* sigue con el HTML */ }
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 10) Chrome/130 Mobile' } });
    const html = await r.text();
    const re = new RegExp(`"template"\\s*:\\s*"(${kind}(?:\\.[^"]+)?)"`);
    // Clase template-<kind>[-sufijo] del <body>; se ignoran assets como template-collection.css
    const m = html.match(re) || [...html.matchAll(new RegExp(`template-${kind}(?:\\.|-)?([\\w-]*)(?!\\.(?:css|js)\\b)(?![\\w-])`, 'g'))]
      .find((x) => !['css', 'js'].includes(x[1]) && !/^\.(css|js)\b/.test(html.slice(x.index + x[0].length)));
    if (m) {
      const name = m[1].startsWith(kind) ? m[1] : (m[1] ? `${kind}.${m[1]}` : kind);
      return { suffix: name === kind ? '' : name.slice(kind.length + 1), via: 'HTML' };
    }
  } catch { /* sin red */ }
  return { suffix: '', via: 'default (no se pudo leer la URL)' };
}

const BUILDER = /^(instant-|gp-|gem-|pagefly|shogun|replo|zipify)/i;
function analyzeTemplate(t) {
  if (!t.path) return { template: t.name, existe: false };
  if (t.path.endsWith('.liquid')) return { template: t.name, existe: true, liquid: true };
  const j = readThemeJson(t.path);
  if (!j) return { template: t.name, existe: true, error: 'JSON inválido' };
  const order = j.order || Object.keys(j.sections || {});
  const secs = order.map((k) => j.sections?.[k]).filter(Boolean);
  const activos = secs.filter((s) => !s.disabled);
  const tipos = activos.map((s) => s.type);
  const builder = tipos.filter((t2) => BUILDER.test(t2));
  const apps = tipos.filter((t2) => t2.startsWith('shopify://apps/'));
  const size = (type) => { try { return statSync(join(themeDir, 'sections', `${type}.liquid`)).size; } catch { return 0; } };
  const bytesTot = tipos.reduce((n, x) => n + size(x), 0);
  const bytesBuilder = builder.reduce((n, x) => n + size(x), 0);
  const appBlocks = activos.flatMap((s) => Object.values(s.blocks || {})).filter((b) => String(b.type).startsWith('shopify://apps/')).map((b) => b.type.split('/')[3]);
  return {
    template: t.name, existe: true, secciones: activos.length, desactivadas: secs.length - activos.length,
    builder: builder.length, pct_builder: activos.length ? Math.round((builder.length / activos.length) * 100) : 0,
    pct_builder_bytes: bytesTot ? Math.round((bytesBuilder / bytesTot) * 100) : 0,
    tipos_builder: [...new Set(builder.map((x) => x.split('-')[0]))],
    app_sections: apps.map((x) => x.split('/')[3]), app_blocks: [...new Set(appBlocks)],
    tipos,
  };
}

async function detect() {
  step('Tipo de tienda');
  if (!themeHasFiles()) { did('sin theme/ todavía: se detecta después del pull'); return null; }
  const [pdpT, colT] = await Promise.all([realTemplate('product', urls.pdp), realTemplate('collection', urls.collection)]);
  const paginas = {
    home: analyzeTemplate(templateFor('index', '')),
    pdp: { ...analyzeTemplate(templateFor('product', pdpT.suffix)), detectado_via: pdpT.via },
    collection: { ...analyzeTemplate(templateFor('collection', colT.suffix)), detectado_via: colT.via },
  };
  const schema = readThemeJson(join(themeDir, 'config/settings_schema.json'));
  const info = Array.isArray(schema) ? schema.find((s) => s.name === 'theme_info') : null;
  const sd = readThemeJson(join(themeDir, 'config/settings_data.json'));
  const cur = sd ? (typeof sd.current === 'string' ? sd.presets?.[sd.current] : sd.current) : null;
  const embeds = Object.values(cur?.blocks || {}).filter((b) => String(b.type).startsWith('shopify://apps/'))
    .map((b) => ({ app: b.type.split('/')[3], bloque: b.type.split('/')[5], encendido: !b.disabled }));
  const layouts = readdirSync(join(themeDir, 'layout')).filter((f) => f.endsWith('.liquid'));
  const sections = existsSync(join(themeDir, 'sections')) ? readdirSync(join(themeDir, 'sections')) : [];
  const builderFiles = {
    instant: sections.filter((f) => /^instant-/.test(f)).length,
    gempages: sections.filter((f) => /^(gp-|gem-)/.test(f)).length + layouts.filter((f) => /gempages/.test(f)).length,
  };

  const maxPct = Math.max(...Object.values(paginas).map((p) => Math.max(p.pct_builder || 0, p.pct_builder_bytes || 0)));
  const tipo = maxPct >= 50 ? 'page builder (las secciones de builder dominan al menos una página clave)'
    : maxPct > 0 ? 'tema + page builder parcial' : 'tema estándar (secciones del tema)';

  console.log(`  Tema: ${info?.theme_name || '?'} ${info?.theme_version || ''} (${info?.theme_author || 'autor ?'}) · layouts: ${layouts.join(', ')}`);
  console.log(`  Archivos de builder en sections/: Instant ${builderFiles.instant} · GemPages ${builderFiles.gempages}`);
  printTable(['página', 'template', 'vía', 'secciones', 'builder', '% secc.', '% liquid', 'apps (secciones/bloques)'],
    Object.entries(paginas).map(([k, p]) => [k, p.template + (p.existe ? '' : ' (NO EXISTE)'), p.detectado_via || 'index', p.secciones ?? '—', p.builder ?? '—', p.pct_builder !== undefined ? `${p.pct_builder}%` : '—', p.pct_builder_bytes !== undefined ? `${p.pct_builder_bytes}%` : '—',
      [...(p.app_sections || []), ...(p.app_blocks || [])].join(', ') || '—']));
  const on = embeds.filter((e) => e.encendido), off = embeds.filter((e) => !e.encendido);
  const names = (l) => { const c = {}; for (const e of l) c[e.app] = (c[e.app] || 0) + 1; return Object.entries(c).map(([a, n]) => (n > 1 ? `${a} ×${n}` : a)).join(', ') || '—'; };
  console.log(`\n  App embeds ENCENDIDOS (${on.length}): ${names(on)}`);
  console.log(`  App embeds apagados (${off.length}): ${names(off)}`);
  console.log('  (% liquid = peso de los .liquid de builder sobre el total de secciones de esa página)');
  console.log(`\n  ⇒ ${tipo}`);
  if (builderFiles.instant) console.log('    Instant regenera sections/instant-*.liquid al re-publicar: anota en CHANGELOG qué re-aplicar.');

  const perfil = {
    generado: new Date().toISOString(), store, urls, tema: info ? { schema_name: info.theme_name, version: info.theme_version, autor: info.theme_author } : null,
    tipo, paginas, builder_files: builderFiles, app_embeds: embeds, layouts,
  };
  if (!dry) { mkdirSync(join(dir, 'data'), { recursive: true }); writeFileSync(join(dir, 'data/tienda.json'), JSON.stringify(perfil, null, 2) + '\n'); did('→ data/tienda.json'); }
  return perfil;
}

await detect();

// ---------- resumen ----------
console.log('\n══ Resumen ══');
console.log(`Carpeta: ${dir}`);
console.log(`WORK_THEME_ID: ${workThemeId || '(pendiente)'}`);
if (previewUrl) console.log(`Preview: ${previewUrl}`);
if (pushErrores.length) console.log(`Errores preexistentes en live: ${pushErrores.length} (data/push-errores-preexistentes.json)`);
console.log(`Siguiente: cd ${dir} && llenar CONSTRAINTS.md → node ${join(TOOLKIT_ROOT, 'scripts/crux-baseline.mjs')} (Paso 3)`);
