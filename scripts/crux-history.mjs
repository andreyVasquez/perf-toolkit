#!/usr/bin/env node
// crux-history.mjs — serie semanal CrUX (~6 meses) de LCP/INP/CLS p75 móvil (backtesting y cierre).
//
// Uso:
//   node scripts/crux-history.mjs --home URL --pdp URL --collection URL [--marca X]
//   node scripts/crux-history.mjs --marca X            (lee stores.json)
//   node scripts/crux-history.mjs --marca X --dry-run  (data de ejemplo, sin API)
//   node <toolkit>/scripts/crux-history.mjs             (desde la carpeta del proyecto: URLs del .env)
//   --out RUTA: archivo .json o carpeta. Default: ./data/history.json del directorio ACTUAL.
//
// Misma escalera de fallback que el baseline: page-level → origin-level, marcada en "fuente".
// Salida: tabla por página en consola + data/history.json.

import { writeFileSync } from 'node:fs';
import {
  METRICS, PAGINAS, parseArgs, resolveTarget, requireApiKey, queryHistory,
  queryWithFallback, resolveOutPath, hoy, printTable,
} from './lib.mjs';

const SEMANAS = 26; // ~6 meses

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);
const apiKey = requireApiKey(dryRun);
const { marca, urls } = resolveTarget(args);
const origin = new URL(urls.home).origin;

if (dryRun) console.log('⚠️  DRY-RUN: data de ejemplo, no viene de la CrUX History API.\n');
console.log(`Historia CrUX · ${marca} · ${origin} · PHONE · últimas ~${SEMANAS} semanas\n`);

// Convierte un record de la History API en [{semana_fin, LCP, INP, CLS}], últimas SEMANAS.
function serieDe(record) {
  const periodos = record.collectionPeriods ?? [];
  const series = periodos.map((p, i) => {
    const fin = p.lastDate;
    const punto = { semana_fin: `${fin.year}-${String(fin.month).padStart(2, '0')}-${String(fin.day).padStart(2, '0')}` };
    for (const [mk, m] of Object.entries(METRICS)) {
      const v = record.metrics?.[mk]?.percentilesTimeseries?.p75s?.[i];
      punto[m.label] = v === undefined || v === null ? null : Number(v);
    }
    return punto;
  });
  return series.slice(-SEMANAS);
}

function dryRunSerie(seed) {
  const serie = [];
  for (let i = 0; i < SEMANAS; i++) {
    const mejora = (SEMANAS - i) / SEMANAS; // tendencia a la baja para el ejemplo
    serie.push({
      semana_fin: `2026-${String(Math.floor(i / 4) + 2).padStart(2, '0')}-${String((i % 4) * 7 + 1).padStart(2, '0')}`,
      LCP: Math.round(2600 + seed * 100 + mejora * 900),
      INP: Math.round(170 + seed * 20 + mejora * 90),
      CLS: Number((0.07 + seed * 0.02 + mejora * 0.08).toFixed(2)),
    });
  }
  return serie;
}

const paginas = [];
for (const [i, pagina] of PAGINAS.entries()) {
  let fuente, serie;
  if (dryRun) {
    fuente = pagina === 'pdp' ? 'crux-origin' : 'crux-page'; // simula la escalera
    serie = dryRunSerie(i);
  } else {
    const r = await queryWithFallback(queryHistory, apiKey, { url: urls[pagina], origin, formFactor: 'PHONE' });
    if (!r) {
      console.log(`⚠️  ${pagina}: sin data CrUX History page-level ni origin-level. Siguiente nivel de la escalera (manual): dashboard Web Performance de Shopify → ShopifyQL.\n`);
      continue;
    }
    fuente = r.fuente;
    serie = serieDe(r.record);
  }
  paginas.push({ pagina, url: urls[pagina], fuente, serie });

  console.log(`── ${pagina} · fuente: ${fuente} ──`);
  printTable(
    ['semana (fin)', 'LCP p75', 'INP p75', 'CLS p75'],
    serie.map((s) => [s.semana_fin, s.LCP ?? '—', s.INP ?? '—', s.CLS ?? '—']),
  );
  console.log('');
}

const salida = {
  marca,
  origin,
  generado: hoy(),
  form_factor: 'PHONE',
  semanas: SEMANAS,
  metodologia_version: '2.0',
  paginas,
};

const outPath = resolveOutPath(args, dryRun ? 'history.dry-run.json' : 'history.json');
writeFileSync(outPath, JSON.stringify(salida, null, 2) + '\n');
console.log(`${paginas.length} páginas con serie → ${outPath}`);
