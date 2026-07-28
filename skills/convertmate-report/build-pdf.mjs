#!/usr/bin/env node
// ConvertMate report kit — genera PDFs con la marca para cualquier proyecto.
// Uso:
//   node build-pdf.mjs --body contenido.html --headline "Título del informe" --out informe.pdf \
//        [--eyebrow "Informe de optimización · Ronda 1"] \
//        [--meta '<span><b>Para</b> · Cliente</span><span><b>Fecha</b> · 27 de julio de 2026</span>'] \
//        [--title "Título de la pestaña"] [--html-out pagina.html] [--chrome /ruta/a/chrome]
//
// --body: fragmento HTML con <section> usando las clases del kit
//         (kicker, cards/card, chip good|bad|warn, delta, callout, tablewrap, work, steps, page-break).
// Chrome se resuelve en este orden: --chrome > $CHROME_PATH > rutas conocidas (macOS/Linux/Windows).
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    body: { type: 'string' },
    headline: { type: 'string' },
    out: { type: 'string' },
    eyebrow: { type: 'string', default: 'Informe · ConvertMate' },
    meta: { type: 'string', default: '' },
    title: { type: 'string' },
    'html-out': { type: 'string' },
    chrome: { type: 'string' },
  },
});

if (!args.body || !args.headline || !args.out) {
  console.error('Faltan argumentos. Mínimo: --body contenido.html --headline "..." --out salida.pdf');
  process.exit(1);
}

function findChrome() {
  const candidates = [
    args.chrome,
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

const kitDir = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(kitDir, 'template.html'), 'utf8');
const body = readFileSync(resolve(args.body), 'utf8');

const html = template
  .replaceAll('{{KIT_URL}}', pathToFileURL(kitDir).href)
  .replaceAll('{{TITLE}}', args.title ?? args.headline)
  .replaceAll('{{EYEBROW}}', args.eyebrow)
  .replaceAll('{{HEADLINE}}', args.headline)
  .replaceAll('{{META_HTML}}', args.meta)
  .replaceAll('{{BODY_HTML}}', body);

const htmlPath = args['html-out']
  ? resolve(args['html-out'])
  : join(mkdtempSync(join(tmpdir(), 'cm-report-')), 'report.html');
writeFileSync(htmlPath, html);

const outPdf = resolve(args.out);
execFileSync(findChrome(), [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${outPdf}`,
  pathToFileURL(htmlPath).href,
], { stdio: 'inherit' });

console.log(`PDF: ${outPdf}`);
if (args['html-out']) console.log(`HTML: ${htmlPath}`);
