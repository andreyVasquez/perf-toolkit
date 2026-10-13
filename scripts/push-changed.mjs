#!/usr/bin/env node
// push-changed.mjs — sube al duplicado SOLO los archivos de theme/ que cambiaron, con drift-check
// del live y smoke check del preview. Se corre desde la carpeta del proyecto (lee su .env).
//
// Uso:
//   node <toolkit>/scripts/push-changed.mjs [--since <ref>] [--dry-run] [--force] [--skip-drift]
//   node <toolkit>/scripts/push-changed.mjs --smoke-only            (solo el smoke check del preview)
//   node <toolkit>/scripts/push-changed.mjs --live --yes-live       (al live: ver regla de oro 8)
//
// 1. Archivos cambiados de theme/ vs el último tag baseline-* (o --since <ref>), incluidos los
//    cambios sin commitear y los archivos nuevos sin trackear.
// 2. EXCLUYE config/settings_data.json, templates/**/*.json y sections/*.json (section groups):
//    viven en el Customizer (Paso 5 del SOP). Avisa si había cambios ahí. Los borrados se avisan.
// 3. Drift-check: `shopify theme pull --live --only <archivo>...` a un tmp y compara con el
//    contenido del baseline. Si el live cambió alguno desde el pull → aborta y lista cuáles
//    (salvo --force). --skip-drift lo salta (no recomendado).
// 4. Push con un `--only` por archivo (array de argumentos, sin shell: nada de word-splitting de zsh)
//    a WORK_THEME_ID (default) o al live con --live --yes-live (agrega --allow-live). Siempre --nodelete.
// 5. Preview URL + smoke check (fetch con cookie de preview: GET /robots.txt?preview_theme_id=ID y
//    se reutilizan las cookies) sobre HOME/PDP/COLLECTION del .env: "id":ID en Shopify.theme
//    y 0 "Liquid error". Exit 1 si algo falla.

import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  parseArgsMulti, str, projectEnv, run, showCmd, git, isCustomizerFile, smokeCheck, printSmoke,
  pagesFromEnv, withPreview, parseJsonLoose,
} from './theme-lib.mjs';

const args = parseArgsMulti(process.argv.slice(2));
if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const cwd = process.cwd();
const env = projectEnv(cwd);
const dry = Boolean(args['dry-run']);
const toLive = Boolean(args.live);
const store = env.SHOPIFY_STORE;
const themeId = toLive ? null : (str(args.theme) || env.WORK_THEME_ID);
const pages = pagesFromEnv(env);

function die(msg, code = 1) { console.error(`✖ ${msg}`); process.exit(code); }

if (!existsSync(join(cwd, '.env'))) die('No hay .env en el directorio actual: corre esto desde la carpeta del proyecto.');
if (!store) die('Falta SHOPIFY_STORE en .env');
if (!toLive && !themeId) die('Falta WORK_THEME_ID en .env (o --theme ID)');
if (toLive && !args['yes-live']) die('--live sube al tema PUBLICADO. Requiere además --yes-live explícito (y aprobación escrita + QA Gate, regla de oro 4).');

async function smoke() {
  const id = toLive ? null : themeId;
  if (!pages.home) { console.log('Sin HOME_URL en .env: no hay smoke check.'); return true; }
  console.log(`\nSmoke check (${toLive ? 'live' : `preview ${id}`}):`);
  const res = await smokeCheck(pages, id);
  printSmoke(res);
  return res.every((r) => r.ok);
}

const previewUrl = pages.home ? (toLive ? pages.home : withPreview(pages.home, themeId)) : `https://${store}/?preview_theme_id=${themeId}`;

if (args['smoke-only']) {
  console.log(`Preview: ${previewUrl}`);
  process.exit((await smoke()) ? 0 : 1);
}

// ---------- 1. archivos cambiados ----------
if (git(['rev-parse', '--git-dir'], cwd).code !== 0) die('El directorio actual no es un repo git (new-project.mjs lo crea).');
let ref = str(args.since);
if (!ref) {
  ref = git(['tag', '--list', 'baseline-*', '--sort=-creatordate'], cwd).stdout.trim().split('\n')[0];
  if (!ref) { // proyectos viejos sin tag: primer commit "live baseline ..."
    ref = git(['log', '--format=%H', '--grep', '^live baseline', '--reverse'], cwd).stdout.trim().split('\n')[0];
    if (ref) console.log(`(sin tag baseline-*: se usa el commit "live baseline" ${ref.slice(0, 7)}; créalo con: git tag baseline-AAAA-MM-DD ${ref.slice(0, 7)})`);
  }
  if (!ref) die('No hay tag baseline-*. Usa --since <ref> (commit del live baseline).');
}
if (git(['rev-parse', '--verify', `${ref}^{commit}`], cwd).code !== 0) die(`Ref inválida: ${ref}`);

const changed = new Map(); // rel → status
for (const line of git(['diff', '--name-status', '--no-renames', ref, '--', 'theme/'], cwd).stdout.split('\n')) {
  const m = line.match(/^([AMDT])\t(.+)$/);
  if (m) changed.set(m[2].replace(/^theme\//, ''), m[1]);
}
for (const f of git(['ls-files', '--others', '--exclude-standard', '--', 'theme/'], cwd).stdout.split('\n').filter(Boolean)) {
  changed.set(f.replace(/^theme\//, ''), 'A');
}
const deleted = [...changed].filter(([, s]) => s === 'D').map(([f]) => f);
const all = [...changed].filter(([, s]) => s !== 'D').map(([f]) => f).sort();
const excluded = all.filter(isCustomizerFile);
const files = all.filter((f) => !isCustomizerFile(f));

console.log(`Proyecto: ${cwd}\nDestino: ${toLive ? 'LIVE (tema publicado)' : `duplicado ${themeId}`} · ${store} · cambios vs ${ref}`);
console.log(`\nA subir (${files.length}):`);
for (const f of files) console.log(`  ${changed.get(f) === 'A' ? '+' : '~'} ${f}`);
if (excluded.length) {
  console.log(`\n⚠️  Excluidos (Customizer: settings_data.json / templates/*.json / sections/*.json) — NO se suben (${excluded.length}):`);
  for (const f of excluded) console.log(`  ! ${f}`);
  console.log('   Si el cambio es necesario, hazlo en el Customizer del duplicado o re-sincroniza en el Paso 7.');
}
if (deleted.length) {
  console.log(`\n⚠️  Borrados localmente (no se borran en remoto; hazlo a mano si aplica): ${deleted.join(', ')}`);
}
if (!files.length) { console.log('\nNada que subir.'); process.exit(0); }

const onlyArgs = files.flatMap((f) => ['--only', f]);
const pullArgs = (dest) => ['theme', 'pull', '--store', store, '--live', '--path', dest, ...onlyArgs];
const pushArgs = ['theme', 'push', '--store', store, '--path', join(cwd, 'theme'), '--nodelete', '--json',
  ...(toLive ? ['--live', '--allow-live'] : ['--theme', String(themeId)]), ...onlyArgs];

if (dry) {
  console.log('\n[dry-run] Comandos que se correrían:');
  if (!args['skip-drift']) console.log(`  drift: ${showCmd('shopify', pullArgs('<tmp>'))}`);
  console.log(`  push:  ${showCmd('shopify', pushArgs)}`);
  console.log(`  preview: ${previewUrl}`);
  process.exit(0);
}

// ---------- 2.5 tienda correcta ----------
// Antes de tocar nada: el dominio público del .env debe servir esta misma tienda, y el tema
// destino debe existir en ella (el CLI puede tener sesión abierta en otra tienda).
{
  if (pages.home) {
    const html = await fetch(pages.home, { redirect: 'follow' }).then((r) => r.text()).catch(() => '');
    const shop = (html.match(/Shopify\.shop\s*=\s*"([^"]+)"/) || [])[1];
    if (shop && shop !== store) die(`La URL ${pages.home} sirve ${shop}, pero SHOPIFY_STORE es ${store}. Revisa el .env.`);
    if (!shop) console.log(`\n⚠️  No se pudo leer Shopify.shop de ${pages.home}; sigo solo con la verificación del CLI.`);
  }
  const ls = run('shopify', ['theme', 'list', '--store', store, '--json']);
  if (ls.code !== 0) die(`shopify theme list --store ${store} falló (¿sesión del CLI?):\n${(ls.stderr || ls.stdout).slice(-600)}`);
  // `theme list --json` devuelve un array; parseJsonLoose solo extrae objetos.
  const arr = ls.stdout.slice(ls.stdout.indexOf('['), ls.stdout.lastIndexOf(']') + 1);
  let themes = [];
  try { themes = JSON.parse(arr); } catch { die(`No se pudo leer la salida de shopify theme list:\n${ls.stdout.slice(0, 400)}`); }
  const target = toLive ? themes.find((t) => t.role === 'live') : themes.find((t) => String(t.id) === String(themeId));
  if (!target) die(toLive ? `El CLI no ve un tema live en ${store}.` : `El tema ${themeId} no existe en ${store}: el CLI o el .env apuntan a otra tienda.`);
  console.log(`\nTienda verificada: ${store} · destino "${target.name}" (${target.id}, ${target.role})`);
}

// ---------- 3. drift-check ----------
const norm = (b) => (b === null ? null : b.toString('utf8').replace(/\r\n/g, '\n').replace(/\s+$/, ''));
if (args['skip-drift']) console.log('\n⚠️  --skip-drift: no se verificó si el live cambió desde el baseline.');
else {
  const tmp = mkdtempSync(join(tmpdir(), 'cm-drift-'));
  mkdirSync(tmp, { recursive: true });
  console.log(`\nDrift-check: bajando del live ${files.length} archivos a ${tmp} …`);
  const r = run('shopify', pullArgs(tmp));
  if (r.code !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    die(`theme pull del live falló (exit ${r.code}):\n${(r.stderr || r.stdout).slice(-2000)}`);
  }
  const drift = [];
  for (const f of files) {
    const livePath = join(tmp, f);
    const live = existsSync(livePath) ? readFileSync(livePath) : null;
    const b = spawnSync('git', ['show', `${ref}:theme/${f}`], { cwd, maxBuffer: 256 * 1024 * 1024 }); // Buffer: assets binarios
    const base = b.status === 0 ? b.stdout : null;
    if (norm(live) !== norm(base)) {
      drift.push(`${f} — ${base === null ? 'no existía en el baseline y ahora existe en el live' : live === null ? 'existía en el baseline y ya no está en el live' : 'el live cambió desde el baseline'}`);
    }
  }
  if (drift.length) {
    console.log(`\n✖ DRIFT: el live cambió en ${drift.length} de los archivos a subir:`);
    for (const d of drift) console.log(`  · ${d}`);
    console.log(`  Copia del live en: ${tmp} — integra esos cambios en tu copia (o confirma que se pueden pisar) y vuelve a correr.`);
    if (!args.force) process.exit(1);
    console.log('  --force: se sube igual.');
  } else {
    console.log(`  OK: los ${files.length} archivos del live son idénticos al baseline ${ref}.`);
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- 4. push ----------
console.log(`\n$ ${showCmd('shopify', pushArgs)}`);
const p = run('shopify', pushArgs);
const json = parseJsonLoose(p.stdout) || parseJsonLoose(p.stderr);
const out = (p.stdout + '\n' + p.stderr).replace(/\x1b\[[0-9;]*m/g, '');
const errLines = out.split('\n').filter((l) => /error/i.test(l) && !/^\s*[{}"]/.test(l)).map((l) => l.trim()).filter(Boolean);
if (p.code !== 0) {
  console.log(out.slice(-3000));
  die(`push falló (exit ${p.code}).`);
}
if (errLines.length) { console.log('⚠️  El push reportó:'); errLines.slice(0, 20).forEach((l) => console.log(`  ${l}`)); }
console.log(`Push OK · ${files.length} archivos → ${json?.theme?.name ? `"${json.theme.name}" ` : ''}${toLive ? 'live' : themeId}`);
console.log(`Preview: ${previewUrl}`);
if (json?.theme?.editor_url) console.log(`Editor:  ${json.theme.editor_url}`);

// ---------- 5. smoke ----------
const ok = await smoke();
if (!ok) die('Smoke check con fallos (tema servido distinto o Liquid error).');
console.log('\nListo. Anota el fix en CHANGELOG.md (Paso 5).');
