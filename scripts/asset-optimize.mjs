#!/usr/bin/env node
// asset-optimize.mjs — convierte assets del Frente B (Paso 6) ANTES de que abra la ventana de contenido.
// No sube nada a la tienda: solo deja archivos locales listos + tabla de ahorro.
//
// Uso (desde la carpeta del proyecto):
//   node <toolkit>/scripts/asset-optimize.mjs --url URL [--url URL ...] [--width 1080]
//   node <toolkit>/scripts/asset-optimize.mjs --urls lista.txt          (una URL o ruta local por línea, # = comentario)
//   node <toolkit>/scripts/asset-optimize.mjs --plan data/assets-plan.json   (usa plan[].asset; el ancho
//        sale de "spec" ("… · 120px") y el id/orden del plan)
//   Flags: --dry-run · --force (re-convierte aunque exista) · --width N (ancho máx. de imágenes, default
//          sin resize; SVG default 1080) · --maxrate 2500k · --crf 26 · --no-audio · --out-json RUTA
//
// Imágenes (jpg/png/webp/avif) → WebP con TinyPNG (TINYPNG_API_KEY en .env; /shrink + convert image/webp,
//   resize "scale" solo si el original es más ancho que --width). SVG → PNG rasterizado (Chrome) → WebP.
// Videos (mp4/mov/webm) y GIF → MP4 H.264 ≤720p (lado corto), ≤2.5 Mbps (maxrate), faststart, AAC 96k
//   + poster WebP del primer segundo (cwebp si existe; si no, TinyPNG; si no, JPG).
// Salida: assets-src/originales/{imagenes,videos}/ · assets-src/optimizados/{imagenes,videos}/
//   (poster: <nombre>-poster.webp) · data/asset-optimize.json · tabla de ahorro en consola.

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { join, basename, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgsMulti, str, projectEnv, run, fmtBytes, printTable, findChrome } from './theme-lib.mjs';

const args = parseArgsMulti(process.argv.slice(2), ['url']);
if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const env = projectEnv();
const dry = Boolean(args['dry-run']);
const force = Boolean(args.force);
const KEY = env.TINYPNG_API_KEY;
const MAXRATE = str(args.maxrate) || '2500k';
const CRF = str(args.crf) || '26';
const DEFAULT_W = Number(args.width) || null;
const ROOT = process.cwd();
const DIRS = {
  oi: join(ROOT, 'assets-src/originales/imagenes'), ov: join(ROOT, 'assets-src/originales/videos'),
  di: join(ROOT, 'assets-src/optimizados/imagenes'), dv: join(ROOT, 'assets-src/optimizados/videos'),
};

// ---------- entrada ----------
const items = [];
const norm = (u) => (existsSync(u) ? pathToFileURL(resolve(u)).toString() : /^(https?|file):\/\//.test(u) ? u : `https://${u.replace(/^\/\//, '')}`);
for (const u of args.url.filter((x) => typeof x === 'string')) items.push({ url: norm(u) });
if (str(args.urls)) {
  for (const l of readFileSync(args.urls, 'utf8').split('\n').map((x) => x.trim())) if (l && !l.startsWith('#')) items.push({ url: norm(l.split(/\s+/)[0]) });
}
if (str(args.plan)) {
  const plan = JSON.parse(readFileSync(args.plan, 'utf8'));
  for (const p of plan.plan || plan) {
    if (!p.asset || /^instant:/.test(p.asset) && !p.url) continue;
    const w = (String(p.spec || '').match(/(\d{2,4})px/) || [])[1];
    items.push({ url: norm(p.url || p.asset), id: p.id, width: w ? Number(w) : undefined, nombre: p.nombre });
  }
}
if (!items.length) {
  console.error('Uso: --url URL [--url …] | --urls lista.txt | --plan data/assets-plan.json  [--dry-run] [--width N] [--force]');
  process.exit(2);
}

const kindOf = (name) => {
  const e = extname(name).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.m4v'].includes(e)) return 'video';
  if (e === '.gif') return 'gif';
  if (e === '.svg') return 'svg';
  return 'imagen';
};
// Nombre local: basename sin query; si se repite, se antepone el segmento anterior del path.
const seen = new Map();
for (const it of items) {
  const u = new URL(it.url);
  const segs = u.pathname.split('/').filter(Boolean);
  let name = it.nombre || decodeURIComponent(segs.at(-1) || 'asset');
  if (seen.has(name) && segs.length > 1) name = `${segs.at(-2)}-${name}`;
  seen.set(name, true);
  it.name = name.replace(/[^\w.@-]+/g, '_');
  it.kind = kindOf(it.name);
  it.width = it.width || (it.kind === 'svg' ? DEFAULT_W || 1080 : DEFAULT_W);
  // Original del CDN de Shopify: sin width/height/crop (los pide el tema, no son el archivo).
  for (const k of ['width', 'height', 'crop', 'format']) u.searchParams.delete(k);
  it.src = u.toString();
}

const stem = (n) => n.replace(/\.[^.]+$/, '');
const outPathFor = (it) => (it.kind === 'video' || it.kind === 'gif' ? join(DIRS.dv, `${stem(it.name)}.mp4`) : join(DIRS.di, `${stem(it.name)}.webp`));
const origPathFor = (it) => join(it.kind === 'video' || it.kind === 'gif' ? DIRS.ov : DIRS.oi, it.name);

console.log(`Assets: ${items.length} (${['imagen', 'svg', 'gif', 'video'].map((k) => `${k} ${items.filter((i) => i.kind === k).length}`).join(' · ')})${dry ? '\n⚠️  DRY-RUN: no se descarga ni convierte nada.' : ''}`);
if (items.some((i) => ['imagen', 'svg'].includes(i.kind)) && !KEY) console.log('⚠️  Sin TINYPNG_API_KEY en .env: las imágenes se saltan.');
const hasFfmpeg = run('sh', ['-c', 'command -v ffmpeg']).code === 0;
const hasCwebp = run('sh', ['-c', 'command -v cwebp']).code === 0;
if (items.some((i) => ['video', 'gif'].includes(i.kind)) && !hasFfmpeg) console.log('⚠️  Sin ffmpeg (brew install ffmpeg): los videos se saltan.');

if (dry) {
  printTable(['id', 'tipo', 'archivo', 'ancho', 'destino'], items.map((i) => [i.id || '—', i.kind, i.name, i.width || '—', outPathFor(i).replace(ROOT + '/', '')]));
  process.exit(0);
}
Object.values(DIRS).forEach((d) => mkdirSync(d, { recursive: true }));

// ---------- helpers ----------
async function download(it) {
  const p = origPathFor(it);
  if (existsSync(p) && statSync(p).size > 0) return p;
  if (it.src.startsWith('file:')) { copyFileSync(fileURLToPath(it.src), p); return p; }
  const r = await fetch(it.src);
  if (!r.ok) throw new Error(`GET ${r.status} ${it.src}`);
  writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  return p;
}

// Cuentas free (500/mes): al agotarse la 1ª (429) se pasa a TINYPNG_API_KEY_2, TINYPNG_API_KEY_3…
const KEYS = [KEY, ...Object.keys(env).filter((k) => /^TINYPNG_API_KEY_\d+$/.test(k)).sort().map((k) => env[k])].filter(Boolean);
let keyIdx = 0;
const authFor = (i) => `Basic ${Buffer.from(`api:${KEYS[i]}`).toString('base64')}`;
let AUTH = KEYS.length ? authFor(0) : null;
let compressionCount = null;
async function tinyWebp(buf, width) {
  const r = await fetch('https://api.tinify.com/shrink', { method: 'POST', headers: { Authorization: AUTH }, body: buf });
  const info = await r.json().catch(() => ({}));
  if (r.status === 429 && keyIdx + 1 < KEYS.length) {
    keyIdx += 1; AUTH = authFor(keyIdx);
    console.log(`  TinyPNG: cuenta ${keyIdx} agotada, sigo con la key ${keyIdx + 1}`);
    return tinyWebp(buf, width);
  }
  if (!r.ok) throw new Error(`TinyPNG ${r.status}: ${info.message || info.error || ''}`);
  compressionCount = r.headers.get('compression-count') || compressionCount;
  const body = { convert: { type: 'image/webp' } };
  const srcW = info.output?.width;
  if (width && srcW && width < srcW) body.resize = { method: 'scale', width: Math.round(width) };
  const r2 = await fetch(r.headers.get('location'), { method: 'POST', headers: { Authorization: AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r2.ok) throw new Error(`TinyPNG convert ${r2.status}`);
  return { buf: Buffer.from(await r2.arrayBuffer()), srcW, finalW: body.resize ? body.resize.width : srcW };
}

let browser = null;
async function svgToPng(svgPath, width) {
  if (!browser) { const { default: puppeteer } = await import('puppeteer-core'); browser = await puppeteer.launch({ executablePath: findChrome(args.chrome), headless: 'new' }); }
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: Math.max(width, 100), height: 100 });
    const b64 = readFileSync(svgPath).toString('base64');
    await page.setContent(`<html><body style="margin:0"><img id="i" src="data:image/svg+xml;base64,${b64}" style="display:block;width:${width}px;height:auto"></body></html>`, { waitUntil: 'load' });
    const el = await page.$('#i');
    return Buffer.from(await el.screenshot({ omitBackground: true, type: 'png' }));
  } finally { await page.close(); }
}

function probe(p) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name,bit_rate:format=bit_rate,duration', '-of', 'json', p]);
  try { const j = JSON.parse(r.stdout); const s = j.streams?.[0] || {}; return { w: s.width, h: s.height, codec: s.codec_name, kbps: Math.round(Number(s.bit_rate || j.format?.bit_rate || 0) / 1000), dur: Number(j.format?.duration || 0) }; } catch { return {}; }
}

async function posterFor(mp4, posterPath) {
  const png = join(tmpdir(), `cm-poster-${process.pid}-${basename(mp4)}.png`);
  const r = run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-ss', '0.3', '-i', mp4, '-frames:v', '1', png]);
  if (r.code !== 0 || !existsSync(png)) return null;
  try {
    if (hasCwebp && run('cwebp', ['-quiet', '-q', '78', png, '-o', posterPath]).code === 0) return posterPath;
    if (AUTH) { writeFileSync(posterPath, (await tinyWebp(readFileSync(png))).buf); return posterPath; }
    const jpg = posterPath.replace(/\.webp$/, '.jpg');
    run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', jpg]);
    return existsSync(jpg) ? jpg : null;
  } finally { rmSync(png, { force: true }); }
}

async function processItem(it) {
  const out = outPathFor(it);
  const res = { id: it.id || null, tipo: it.kind, nombre: it.name, url: it.src, original: null, optimizado: null, archivo_optimizado: out.replace(ROOT + '/', ''), spec: null, nota: '' };
  try {
    const orig = await download(it);
    res.original = statSync(orig).size;
    if (existsSync(out) && !force) { res.optimizado = statSync(out).size; res.nota = 'ya existía (usa --force)'; }
    else if (it.kind === 'imagen' || it.kind === 'svg') {
      if (!AUTH) { res.nota = 'sin TINYPNG_API_KEY'; return res; }
      const input = it.kind === 'svg' ? await svgToPng(orig, it.width) : readFileSync(orig);
      const t = await tinyWebp(input, it.width);
      writeFileSync(out, t.buf);
      res.optimizado = t.buf.length;
      res.spec = `WebP TinyPNG · ${t.finalW || '?'}px${it.kind === 'svg' ? ' (SVG rasterizado)' : ''}`;
    } else {
      if (!hasFfmpeg) { res.nota = 'sin ffmpeg'; return res; }
      const p = probe(orig);
      // ≤720 en el lado corto, sin agrandar; dimensiones pares para yuv420p.
      const scale = (p.w && p.h && Math.min(p.w, p.h) > 720)
        ? (p.w >= p.h ? 'scale=-2:720' : 'scale=720:-2')
        : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
      const bufsize = `${parseInt(MAXRATE, 10) * 2}k`;
      const tmpOut = `${out}.tmp.mp4`;
      const a = ['-nostdin', '-loglevel', 'error', '-y', '-i', orig, '-vf', `${scale},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
        '-maxrate', MAXRATE, '-bufsize', bufsize, '-profile:v', 'high', ...(args['no-audio'] || it.kind === 'gif' ? ['-an'] : ['-c:a', 'aac', '-b:a', '96k', '-ac', '2']), '-movflags', '+faststart', tmpOut];
      const r = run('ffmpeg', a);
      if (r.code !== 0) throw new Error(`ffmpeg: ${r.stderr.slice(-400)}`);
      run('mv', [tmpOut, out]);
      const q = probe(out);
      res.optimizado = statSync(out).size;
      res.spec = `H.264 ${q.w}x${q.h} · ${(q.kbps / 1000).toFixed(2)} Mbps · faststart + poster WebP`;
      res.antes = `${p.codec || '?'} ${p.w}x${p.h} · ${p.kbps} kbps`;
    }
    if ((it.kind === 'video' || it.kind === 'gif')) {
      const poster = join(DIRS.dv, `${stem(it.name)}-poster.webp`);
      if (!existsSync(poster) || force) res.poster = (await posterFor(out, poster))?.replace(ROOT + '/', '') || null;
      else res.poster = poster.replace(ROOT + '/', '');
    }
  } catch (e) { res.nota = `ERROR ${e.message}`; }
  return res;
}

// ---------- ejecución: imágenes en paralelo (4), videos en serie ----------
const results = [];
const imgs = items.filter((i) => i.kind === 'imagen' || i.kind === 'svg');
const vids = items.filter((i) => i.kind === 'video' || i.kind === 'gif');
for (let i = 0; i < imgs.length; i += 4) results.push(...await Promise.all(imgs.slice(i, i + 4).map(processItem)));
for (const v of vids) { process.stderr.write(`  video ${v.name}…\n`); results.push(await processItem(v)); }
if (browser) await browser.close();

const pct = (a, b) => (a && b ? `${Math.round((1 - b / a) * 100)}%` : '—');
printTable(['id', 'tipo', 'archivo', 'original', 'optimizado', 'ahorro', '%', 'spec / nota'],
  results.map((r) => [r.id || '—', r.tipo, r.nombre.slice(0, 48), fmtBytes(r.original), fmtBytes(r.optimizado),
    r.original && r.optimizado ? fmtBytes(r.original - r.optimizado) : '—', pct(r.original, r.optimizado), r.nota || r.spec || '']));
const tot = results.filter((r) => r.original && r.optimizado);
const to = tot.reduce((s, r) => s + r.original, 0), tn = tot.reduce((s, r) => s + r.optimizado, 0);
console.log(`\nTotal (${tot.length} convertidos): ${fmtBytes(to)} → ${fmtBytes(tn)} · ahorro ${fmtBytes(to - tn)} (${pct(to, tn)})${compressionCount ? ` · TinyPNG compresiones este mes: ${compressionCount}` : ''}`);
console.log('Ojo: el ahorro de archivo no es el ahorro por visita (el CDN ya redimensiona imágenes con width). Ver AUDIT-CONTENT.md.');

const outJson = str(args['out-json']) || join(ROOT, 'data/asset-optimize.json');
mkdirSync(dirname(resolve(outJson)), { recursive: true });
writeFileSync(outJson, JSON.stringify({ generado: new Date().toISOString(), maxrate: MAXRATE, crf: CRF, resultados: results }, null, 2) + '\n');
console.log(`→ ${outJson}`);
