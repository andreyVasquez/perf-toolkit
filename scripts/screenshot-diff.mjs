#!/usr/bin/env node
// screenshot-diff.mjs — preview vs live, mobile + desktop (check 1 del QA Gate, Paso 6.5).
//
// Uso:
//   node scripts/screenshot-diff.mjs --live URL --preview URL_CON_preview_theme_id --out data/qa/
//
// Toma screenshots full-page de ambas URLs en mobile (412×915) y desktop (1440×900),
// genera el diff visual por par y resume en consola el % de píxeles distintos.
// Umbral de alerta: 1% — por encima, la diferencia se revisa (las esperables del fix
// se anotan; las inesperadas BLOQUEAN la publicación). Exit code 1 si algún par supera el umbral.
//
// Dependencias: puppeteer-core + pixelmatch + pngjs (npm install en la raíz del toolkit).
// Chrome local: --chrome > $CHROME_PATH > rutas conocidas (macOS/Linux/Windows), el mismo orden
// que usan pixel-check.mjs y net-check.mjs (theme-lib.mjs). No instala Chromium propio.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import puppeteer from 'puppeteer-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { parseArgs } from './lib.mjs';

const UMBRAL_ALERTA = 1; // % de píxeles distintos

const VIEWPORTS = {
  mobile: { width: 412, height: 915, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
};

const args = parseArgs(process.argv.slice(2));
if (!args.live || !args.preview || !args.out) {
  console.error('Uso: --live URL --preview URL --out data/qa/  [--chrome /ruta/a/chrome]');
  process.exit(1);
}

// Orden de resolución: --chrome > $CHROME_PATH > rutas conocidas.
function findChrome() {
  const candidates = [
    typeof args.chrome === 'string' ? args.chrome : undefined,
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find(existsSync);
  if (!found) {
    console.error('No se encontró Chrome/Chromium. Pasa --chrome /ruta/al/binario o define CHROME_PATH.');
    process.exit(1);
  }
  return found;
}

// Slug para nombrar archivos: path de la URL live ('/' → 'home').
function slugDe(url) {
  const path = new URL(url).pathname.replace(/\/+$/, '');
  return path ? path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() : 'home';
}

async function capturar(browser, url, viewport) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    // Congela animaciones/transiciones y fuerza la carga de lazy-load antes del full-page.
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await page.evaluate(async () => {
      await new Promise((done) => {
        let y = 0;
        const paso = () => {
          y += 800;
          window.scrollTo(0, y);
          if (y < document.body.scrollHeight) setTimeout(paso, 120);
          else { window.scrollTo(0, 0); setTimeout(done, 500); }
        };
        paso();
      });
    });
    return PNG.sync.read(Buffer.from(await page.screenshot({ fullPage: true, type: 'png' })));
  } finally {
    await page.close();
  }
}

// pixelmatch exige dimensiones iguales: rellena la imagen menor con blanco.
function igualar(a, b) {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (img) => {
    if (img.width === width && img.height === height) return img;
    const out = new PNG({ width, height, fill: true });
    out.data.fill(255);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
  };
  return [pad(a), pad(b), width, height];
}

const outDir = resolve(process.cwd(), args.out);
mkdirSync(outDir, { recursive: true });
const slug = slugDe(args.live);

console.log(`Screenshot-diff · ${slug}`);
console.log(`  live:    ${args.live}`);
console.log(`  preview: ${args.preview}\n`);

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
const resumen = [];

try {
  for (const [nombre, viewport] of Object.entries(VIEWPORTS)) {
    let live, preview;
    try {
      live = await capturar(browser, args.live, viewport);
      preview = await capturar(browser, args.preview, viewport);
    } catch (err) {
      console.error(`✖ ${nombre}: fallo capturando (${err.message})`);
      resumen.push({ nombre, error: true });
      continue;
    }

    const [a, b, width, height] = igualar(live, preview);
    const diff = new PNG({ width, height });
    const distintos = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
    const pct = (distintos / (width * height)) * 100;

    const base = `${slug}-${nombre}`;
    writeFileSync(join(outDir, `${base}-live.png`), PNG.sync.write(a));
    writeFileSync(join(outDir, `${base}-preview.png`), PNG.sync.write(b));
    writeFileSync(join(outDir, `${base}-diff.png`), PNG.sync.write(diff));

    if (live.width !== preview.width || live.height !== preview.height) {
      console.log(`  (${nombre}: dimensiones distintas — live ${live.width}×${live.height} vs preview ${preview.width}×${preview.height}; se rellenó con blanco)`);
    }
    resumen.push({ nombre, pct, distintos, total: width * height });
  }
} finally {
  await browser.close();
}

console.log('\nResumen (% de píxeles distintos · umbral de alerta 1%):\n');
let alerta = false;
for (const r of resumen) {
  if (r.error) { console.log(`  🔴 ${r.nombre.padEnd(8)} ERROR de captura`); alerta = true; continue; }
  const icono = r.pct > UMBRAL_ALERTA ? '🔴' : '🟢';
  if (r.pct > UMBRAL_ALERTA) alerta = true;
  console.log(`  ${icono} ${r.nombre.padEnd(8)} ${r.pct.toFixed(2)}%  (${r.distintos.toLocaleString('en-US')} de ${r.total.toLocaleString('en-US')} px)`);
}
console.log(`\nCapturas y diffs → ${outDir}`);
if (alerta) {
  console.log('⚠️  Diferencias sobre el umbral: anota las esperables (las del fix); las inesperadas BLOQUEAN la publicación.');
  process.exit(1);
}
