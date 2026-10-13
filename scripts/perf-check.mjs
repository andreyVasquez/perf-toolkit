#!/usr/bin/env node
// perf-check.mjs — tabla semáforo CrUX del portafolio (sección 8 del SOP).
// Opcional y a demanda: sin estado, sin calendario, no escribe archivos.
//
// Uso:
//   node scripts/perf-check.mjs --all           (todas las marcas de stores.json)
//   node scripts/perf-check.mjs --marca X       (solo esa marca)
//   node scripts/perf-check.mjs --all --dry-run (data de ejemplo, sin API)
//
// Semáforo por umbral del SOP (p75 móvil): 🟢 LCP ≤ 2500 ms · INP ≤ 200 ms · CLS ≤ 0.1.
// 🔴 sobre el límite CWV de "pobre" (4000 ms / 500 ms / 0.25); 🟡 entre ambos; ⚪ sin data.
// Fuente por página: crux-page u origin (escalera de fallback de la sección 2).

import {
  METRICS, PAGINAS, parseArgs, requireApiKey, loadStores, storeByMarca,
  queryRecord, queryWithFallback, p75, fmtValor, semaforo, printTable, dryRunRecord,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);
const apiKey = requireApiKey(dryRun);

let stores;
if (args.all) stores = loadStores();
else if (typeof args.marca === 'string') stores = [storeByMarca(args.marca)];
else {
  console.error('Uso: --all | --marca X. Opcional: --dry-run');
  process.exit(1);
}
if (stores.length === 0) {
  console.error('stores.json no tiene marcas con datos.');
  process.exit(1);
}

if (dryRun) console.log('⚠️  DRY-RUN: data de ejemplo, no viene de la CrUX API.\n');
console.log(`Semáforo CrUX · p75 móvil · ${stores.length} marca(s)\n`);

const rows = [];
for (const [si, store] of stores.entries()) {
  const origin = new URL(store.home).origin;
  for (const [pi, pagina] of PAGINAS.entries()) {
    let r;
    if (dryRun) {
      r = { fuente: pi === 1 ? 'crux-origin' : 'crux-page', record: dryRunRecord(si * 3 + pi) };
    } else {
      r = await queryWithFallback(queryRecord, apiKey, { url: store[pagina], origin, formFactor: 'PHONE' });
    }
    if (!r) {
      rows.push([store.marca, pagina, 'sin data', ...Object.values(METRICS).map(() => '⚪ —')]);
      continue;
    }
    const celdas = Object.entries(METRICS).map(([mk, m]) => {
      const v = p75(r.record, mk);
      return `${semaforo(m.label, v)} ${fmtValor(m.label, v)}`;
    });
    rows.push([store.marca, pagina, r.fuente === 'crux-page' ? 'page' : 'origin', ...celdas]);
  }
}

printTable(['marca', 'página', 'fuente', 'LCP', 'INP', 'CLS'], rows);
