// Utilidades compartidas por los scripts CrUX del toolkit.
// Node 18+, ESM, sin dependencias externas (fetch nativo).

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const CRUX_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
export const CRUX_HISTORY_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';

export const METRICS = {
  largest_contentful_paint: { label: 'LCP', unidad: 'ms' },
  interaction_to_next_paint: { label: 'INP', unidad: 'ms' },
  cumulative_layout_shift: { label: 'CLS', unidad: 'score' },
};

// Umbrales del SOP (verde) + límite estándar CWV de "pobre" (rojo). Entre ambos: amarillo.
export const UMBRALES = {
  LCP: { verde: 2500, rojo: 4000 },
  INP: { verde: 200, rojo: 500 },
  CLS: { verde: 0.1, rojo: 0.25 },
};

export const PAGINAS = ['home', 'pdp', 'collection'];

// Lee .env del directorio actual (formato KEY=VALUE, sin sobreescribir el entorno).
export function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Parser mínimo de argumentos: --flag valor | --flag (booleano).
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; }
    else args[key] = true;
  }
  return args;
}

export function loadStores() {
  const stores = JSON.parse(readFileSync(resolve(REPO_ROOT, 'stores.json'), 'utf8'));
  return stores.filter((s) => s.marca);
}

export function storeByMarca(marca) {
  const store = loadStores().find((s) => s.marca.toLowerCase() === marca.toLowerCase());
  if (!store) {
    console.error(`Marca "${marca}" no está en stores.json. Disponibles: ${loadStores().map((s) => s.marca).join(', ') || '(ninguna)'}`);
    process.exit(1);
  }
  return store;
}

// Resuelve las 3 URLs desde --home/--pdp/--collection o desde stores.json con --marca.
export function resolveTarget(args) {
  if (args.home && args.pdp && args.collection) {
    const marca = typeof args.marca === 'string' ? args.marca : new URL(args.home).hostname;
    return { marca, urls: { home: args.home, pdp: args.pdp, collection: args.collection } };
  }
  // Sin flags: las 3 URLs del .env del proyecto (HOME_URL/PDP_URL/COLLECTION_URL).
  loadEnv();
  if (typeof args.marca !== 'string' && process.env.HOME_URL && process.env.PDP_URL && process.env.COLLECTION_URL) {
    return { marca: new URL(process.env.HOME_URL).hostname, urls: { home: process.env.HOME_URL, pdp: process.env.PDP_URL, collection: process.env.COLLECTION_URL } };
  }
  if (typeof args.marca === 'string') {
    const s = storeByMarca(args.marca);
    return { marca: s.marca, urls: { home: s.home, pdp: s.pdp, collection: s.collection } };
  }
  console.error('Uso: --home URL --pdp URL --collection URL  |  --marca X (lee stores.json)  |  sin flags dentro de la carpeta del proyecto (lee .env). Opcional: --out RUTA, --dry-run');
  process.exit(1);
}

export function requireApiKey(dryRun) {
  loadEnv();
  const key = process.env.CRUX_API_KEY;
  if (!key && !dryRun) {
    console.error('No hay CRUX_API_KEY en .env ni en el entorno. Usa --dry-run para ver la salida con data de ejemplo.');
    process.exit(1);
  }
  return key;
}

async function postCrux(endpoint, apiKey, body) {
  let res;
  try {
    res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Fallo de red consultando CrUX: ${err.message}`);
  }
  if (res.status === 404) return null; // sin data para esa URL/origin: no es error, es fallback
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`CrUX API ${res.status}: ${json.error?.message || 'error desconocido'}`);
  }
  return json.record ?? null;
}

export function queryRecord(apiKey, { url, origin, formFactor }) {
  const body = { formFactor, metrics: Object.keys(METRICS) };
  if (url) body.url = url; else body.origin = origin;
  return postCrux(CRUX_ENDPOINT, apiKey, body);
}

export function queryHistory(apiKey, { url, origin, formFactor }) {
  const body = { formFactor, metrics: Object.keys(METRICS) };
  if (url) body.url = url; else body.origin = origin;
  return postCrux(CRUX_HISTORY_ENDPOINT, apiKey, body);
}

// Escalera de fallback del SOP (niveles CrUX): page-level → origin-level.
// Devuelve { fuente: 'crux-page' | 'crux-origin', record } o null si no hay data en ninguno
// (siguiente nivel de la escalera: dashboard Shopify → ShopifyQL, manuales).
export async function queryWithFallback(query, apiKey, { url, origin, formFactor }) {
  const page = await query(apiKey, { url, formFactor });
  if (page) return { fuente: 'crux-page', record: page };
  const org = await query(apiKey, { origin, formFactor });
  if (org) return { fuente: 'crux-origin', record: org };
  return null;
}

export function p75(record, metricKey) {
  const v = record?.metrics?.[metricKey]?.percentiles?.p75;
  return v === undefined || v === null ? null : Number(v);
}

export function histogram(record, metricKey) {
  return record?.metrics?.[metricKey]?.histogram ?? null;
}

export function fmtValor(label, valor) {
  if (valor === null) return '—';
  return label === 'CLS' ? String(valor) : `${valor} ms`;
}

export function semaforo(label, valor) {
  if (valor === null) return '⚪';
  const u = UMBRALES[label];
  if (valor <= u.verde) return '🟢';
  if (valor > u.rojo) return '🔴';
  return '🟡';
}

// Ruta de salida: --out archivo.json | --out carpeta/ ; default ./data/<defaultName> del cwd.
// Avisa si se está escribiendo dentro del toolkit (casi siempre es un error: debe ir al proyecto).
export function resolveOutPath(args, defaultName) {
  const out = typeof args.out === 'string' ? resolve(process.cwd(), args.out) : null;
  const path = out ? (/\.json$/i.test(out) ? out : resolve(out, defaultName)) : resolve(process.cwd(), 'data', defaultName);
  if (path.startsWith(REPO_ROOT + '/')) {
    console.error(`⚠️  La salida queda DENTRO del toolkit (${path}). Corre el script desde la carpeta del proyecto o pasa --out <proyecto>/data/.`);
  }
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

export function hoy() {
  return new Date().toISOString().slice(0, 10);
}

// Imprime una tabla simple alineada por columnas.
export function printTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

// Records fabricados para --dry-run (marcados como ejemplo en la salida de cada script).
export function dryRunRecord(seed = 0) {
  const mk = (p75v, bins) => ({
    percentiles: { p75: p75v },
    histogram: [
      { start: 0, density: bins[0] },
      { density: bins[1] },
      { density: bins[2] },
    ],
  });
  return {
    metrics: {
      largest_contentful_paint: mk(2800 + seed * 150, [0.62, 0.25, 0.13]),
      interaction_to_next_paint: mk(180 + seed * 30, [0.78, 0.15, 0.07]),
      cumulative_layout_shift: mk((0.08 + seed * 0.04).toFixed(2), [0.71, 0.19, 0.1]),
    },
  };
}
