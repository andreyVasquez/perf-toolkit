// theme-lib.mjs — utilidades compartidas por los scripts de proyecto (new-project, push-changed,
// pixel-check, net-check, asset-optimize). Node 18+, ESM, sin dependencias externas.
//
// Regla: los comandos externos (shopify, git, zip, ffmpeg) se lanzan SIEMPRE con spawnSync y un
// array de argumentos, sin shell. Así varios `--only` no dependen del word-splitting de zsh/bash.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOLKIT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

// ---------- argumentos ----------
// --flag valor | --flag (booleano). Las claves en `multi` se acumulan en arrays (p. ej. --url repetido).
export function parseArgsMulti(argv, multi = []) {
  const a = {};
  for (const k of multi) a[k] = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    const val = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
    if (multi.includes(key)) a[key].push(val);
    else a[key] = val;
  }
  return a;
}

export const str = (v) => (typeof v === 'string' && v.length ? v : undefined);

// ---------- .env ----------
export function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// .env del cwd sobre process.env (el entorno manda).
export function projectEnv(cwd = process.cwd()) {
  const file = readEnvFile(resolve(cwd, '.env'));
  const env = { ...file };
  for (const k of Object.keys(env)) if (process.env[k]) env[k] = process.env[k];
  for (const k of ['SHOPIFY_STORE', 'HOME_URL', 'PDP_URL', 'COLLECTION_URL', 'WORK_THEME_ID', 'CRUX_API_KEY', 'TINYPNG_API_KEY']) {
    if (!env[k] && process.env[k]) env[k] = process.env[k];
  }
  return env;
}

// Fija/actualiza KEY=valor en un .env conservando el resto de líneas y comentarios.
export function setEnvVar(path, key, value) {
  const txt = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  const next = re.test(txt) ? txt.replace(re, `${key}=${value}`) : `${txt.replace(/\n*$/, '\n')}${key}=${value}\n`;
  writeFileSync(path, next);
}

// ---------- procesos ----------
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.error) throw new Error(`No se pudo ejecutar ${cmd}: ${r.error.message}`);
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Igual que run, pero con la salida en vivo (para pulls/pushes largos que piden login, etc.).
export function runLive(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw new Error(`No se pudo ejecutar ${cmd}: ${r.error.message}`);
  return r.status;
}

// Representación copiable en zsh/bash de un comando (solo para mostrarlo).
export function showCmd(cmd, args) {
  const q = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`);
  return [cmd, ...args].map(q).join(' ');
}

export function git(args, cwd) {
  return run('git', args, { cwd });
}

// Extrae el primer objeto JSON de una salida que puede traer ruido (warnings, errores de templates).
export function parseJsonLoose(text) {
  const s = String(text || '');
  for (let i = s.indexOf('{'); i !== -1; i = s.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { return JSON.parse(s.slice(i, j + 1)); } catch { break; }
      }
    }
  }
  return null;
}

// ---------- archivos del tema ----------
// Los JSON del tema traen un comentario /* ... */ autogenerado arriba: se quita antes de parsear.
export function readThemeJson(path) {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/^\s*\/\*[\s\S]*?\*\//, '');
  try { return JSON.parse(raw); } catch { return null; }
}

// Archivos que viven en el Customizer: no se suben desde el duplicado (Paso 5 del SOP).
export function isCustomizerFile(rel) {
  return rel === 'config/settings_data.json'
    || /^templates\/.+\.json$/.test(rel)
    || /^sections\/[^/]+\.json$/.test(rel); // section groups (header-group.json, footer-group.json…)
}

// ---------- fechas / slugs ----------
export function fechas(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear(), m = p(d.getMonth() + 1), dd = p(d.getDate());
  return { iso: `${y}-${m}-${dd}`, ym: `${y}-${m}`, ymCompact: `${y}${m}` };
}

export function slugify(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function fmtBytes(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (a >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export function printTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

// ---------- preview / smoke ----------
export function withPreview(url, themeId) {
  if (!themeId) return url;
  const u = new URL(url);
  u.searchParams.set('preview_theme_id', String(themeId));
  return u.toString();
}

function cookiesFrom(res, jar) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  for (const c of list) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

// Fetch siguiendo redirects a mano para reenviar cookies en cada salto.
async function fetchWithJar(url, jar, headers = {}) {
  let current = url;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(current, { redirect: 'manual', headers: { ...headers, cookie: cookieHeader(jar) } });
    cookiesFrom(res, jar);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    return { res, finalUrl: current, body: await res.text() };
  }
  throw new Error(`Demasiados redirects: ${url}`);
}

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

// Smoke check: themeId = duplicado (usa cookie de preview) o null (live, verifica role main).
// Devuelve [{pagina, url, status, themeIdVisto, ok, liquidErrors, bytes, nota}]
export async function smokeCheck(pages, themeId) {
  const out = [];
  const origin = new URL(Object.values(pages).find(Boolean)).origin;
  const jar = new Map();
  if (themeId) {
    // La cookie de preview se fija con cualquier GET que lleve preview_theme_id.
    await fetchWithJar(`${origin}/robots.txt?preview_theme_id=${themeId}`, jar, { 'user-agent': UA }).catch(() => {});
  }
  for (const [pagina, url] of Object.entries(pages)) {
    if (!url) continue;
    const target = themeId ? withPreview(url, themeId) : url;
    try {
      const { res, finalUrl, body } = await fetchWithJar(target, jar, { 'user-agent': UA, 'cache-control': 'no-cache' });
      const m = body.match(/Shopify\.theme\s*=\s*(\{[^;]*?\});/);
      const themeBlock = m ? m[1] : '';
      const idVisto = (themeBlock.match(/"id"\s*:\s*(\d+)/) || [])[1] || null;
      const role = (themeBlock.match(/"role"\s*:\s*"([^"]+)"/) || [])[1] || null;
      const liquidErrors = (body.match(/Liquid error/gi) || []).length;
      const okTheme = themeId ? idVisto === String(themeId) : role === 'main';
      out.push({
        pagina, url: target, finalUrl, status: res.status, themeIdVisto: idVisto, role,
        liquidErrors, bytes: Buffer.byteLength(body), ok: res.status === 200 && okTheme && liquidErrors === 0,
        nota: !m ? 'no se encontró Shopify.theme en el HTML' : (!okTheme ? (themeId ? `sirvió el tema ${idVisto}, no ${themeId}` : `role ${role}, no main`) : ''),
      });
    } catch (e) {
      out.push({ pagina, url: target, status: 'error', ok: false, liquidErrors: null, nota: e.message });
    }
  }
  return out;
}

export function printSmoke(results) {
  printTable(['página', 'status', 'tema servido', 'Liquid error', 'HTML', 'ok', 'nota'],
    results.map((r) => [r.pagina, r.status, r.themeIdVisto ?? '—', r.liquidErrors ?? '—', fmtBytes(r.bytes), r.ok ? 'sí' : 'NO', r.nota || '']));
}

// ---------- Chrome local ----------
// Orden: --chrome > $CHROME_PATH > rutas conocidas (macOS/Linux/Windows). No se instala Chromium propio.
export function findChrome(explicit) {
  const candidates = [
    str(explicit),
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find((c) => existsSync(c));
  if (!found) {
    console.error('No se encontró Chrome/Chromium. Pasa --chrome /ruta/al/binario o define CHROME_PATH.');
    process.exit(2);
  }
  return found;
}

// Las 3 URLs del proyecto desde .env (HOME_URL/PDP_URL/COLLECTION_URL).
export function pagesFromEnv(env) {
  return { home: env.HOME_URL || null, pdp: env.PDP_URL || null, collection: env.COLLECTION_URL || null };
}
