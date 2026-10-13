#!/usr/bin/env node
// crux-baseline.mjs — p75 + histogramas CrUX, PHONE/DESKTOP, origin + 3 URLs (Paso 3 del SOP).
//
// Uso:
//   node scripts/crux-baseline.mjs --home URL --pdp URL --collection URL [--marca X]
//   node scripts/crux-baseline.mjs --marca X            (lee stores.json)
//   node scripts/crux-baseline.mjs --marca X --dry-run  (data de ejemplo, sin API)
//   node <toolkit>/scripts/crux-baseline.mjs             (desde la carpeta del proyecto: URLs del .env)
//   --out RUTA: archivo .json o carpeta. Default: ./data/baseline.json del directorio ACTUAL.
//
// Escalera de fallback (sección 2 del SOP): si una URL no tiene data page-level,
// cae a origin-level y lo marca en el campo "fuente". Si tampoco hay origin, el
// siguiente nivel (dashboard Shopify / ShopifyQL) es manual y se avisa en consola.
//
// Salida: tabla en consola + data/baseline.json (schemas/baseline.schema.json).
// Al JSON van solo las mediciones PHONE (el dato de campo del SOP es p75 móvil);
// DESKTOP es secundario y queda solo en consola.

import { writeFileSync } from 'node:fs';
import {
  METRICS, PAGINAS, parseArgs, resolveTarget, requireApiKey, queryRecord,
  queryWithFallback, resolveOutPath, p75, histogram, fmtValor, hoy, printTable, dryRunRecord,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);
const apiKey = requireApiKey(dryRun);
const { marca, urls } = resolveTarget(args);
const origin = new URL(urls.home).origin;
const fecha = hoy();

if (dryRun) console.log('⚠️  DRY-RUN: data de ejemplo, no viene de la CrUX API.\n');
console.log(`Baseline CrUX · ${marca} · ${origin} · ${fecha}\n`);

// { PHONE: { origin: {fuente, record}|null, home: ..., pdp: ..., collection: ... }, DESKTOP: {...} }
const resultados = {};
for (const formFactor of ['PHONE', 'DESKTOP']) {
  resultados[formFactor] = {};
  if (dryRun) {
    resultados[formFactor].origin = { fuente: 'crux-origin', record: dryRunRecord(0) };
    PAGINAS.forEach((p, i) => {
      // El ejemplo simula la escalera: pdp sin data page-level, cae a origin.
      resultados[formFactor][p] = { fuente: p === 'pdp' ? 'crux-origin' : 'crux-page', record: dryRunRecord(i + 1) };
    });
    continue;
  }
  const org = await queryRecord(apiKey, { origin, formFactor });
  resultados[formFactor].origin = org ? { fuente: 'crux-origin', record: org } : null;
  for (const pagina of PAGINAS) {
    resultados[formFactor][pagina] = await queryWithFallback(queryRecord, apiKey, {
      url: urls[pagina], origin, formFactor,
    });
  }
}

const labels = Object.values(METRICS).map((m) => m.label);

for (const formFactor of ['PHONE', 'DESKTOP']) {
  console.log(`\n══ ${formFactor} ${formFactor === 'PHONE' ? '(dato de campo del SOP: p75 móvil)' : '(secundario)'} ══\n`);
  const rows = [];
  for (const key of ['origin', ...PAGINAS]) {
    const r = resultados[formFactor][key];
    if (!r) {
      rows.push([key, 'sin data', ...labels.map(() => '—')]);
      continue;
    }
    rows.push([key, r.fuente, ...Object.entries(METRICS).map(([mk, m]) => fmtValor(m.label, p75(r.record, mk)))]);
  }
  printTable(['página', 'fuente', ...labels.map((l) => `${l} p75`)], rows);

  console.log('\nHistogramas (buena · mejorable · pobre):');
  for (const key of ['origin', ...PAGINAS]) {
    const r = resultados[formFactor][key];
    if (!r) continue;
    const partes = Object.entries(METRICS).map(([mk, m]) => {
      const h = histogram(r.record, mk);
      if (!h) return `${m.label} —`;
      return `${m.label} ${h.map((b) => `${Math.round((b.density ?? 0) * 100)}%`).join('·')}`;
    });
    console.log(`  ${key.padEnd(10)} ${partes.join('   ')}`);
  }
}

// Avisos de escalera para páginas sin data CrUX en ningún nivel (PHONE).
for (const pagina of PAGINAS) {
  if (!resultados.PHONE[pagina]) {
    console.log(`\n⚠️  ${pagina}: sin data CrUX page-level ni origin-level. Siguiente nivel de la escalera (manual): dashboard Web Performance de Shopify (shopify-rum) → reporte ShopifyQL.`);
  }
}

// data/baseline.json — solo PHONE, validando contra schemas/baseline.schema.json.
const mediciones = [];
for (const pagina of PAGINAS) {
  const r = resultados.PHONE[pagina];
  if (!r) continue;
  for (const [mk, m] of Object.entries(METRICS)) {
    const valor = p75(r.record, mk);
    if (valor === null) continue;
    mediciones.push({
      marca, fecha, url: urls[pagina], pagina,
      metrica: m.label, valor, unidad: m.unidad,
      fuente: r.fuente, metodologia_version: '2.0',
    });
  }
}

const outPath = resolveOutPath(args, dryRun ? 'baseline.dry-run.json' : 'baseline.json');
writeFileSync(outPath, JSON.stringify(mediciones, null, 2) + '\n');
console.log(`\n${mediciones.length} mediciones → ${outPath}`);
if (!dryRun && mediciones.length === 0) {
  console.log('⚠️  baseline.json quedó vacío: ninguna página tiene data CrUX. Documenta el fallback manual en BASELINE.md.');
}
