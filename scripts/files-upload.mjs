#!/usr/bin/env node
// files-upload.mjs — Fase 2: sube (correr desde la carpeta del proyecto) a Files del Admin los assets de assets-src/optimizados según data/assets-plan.json
// (staged upload + fileCreate vía `shopify store execute`) y guarda las URLs nuevas en data/fase2-uploads.json.
// Idempotente: lo ya subido (READY en el json) no se re-sube.
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const STORE = (readFileSync(join(ROOT, '.env'), 'utf8').match(/^SHOPIFY_STORE=(.+)$/m) || [])[1]?.trim();
if (!STORE) throw new Error('SHOPIFY_STORE no está en .env');
// Requiere una vez: shopify store auth --store <store> --scopes read_files,write_files
const OUT = join(ROOT, 'data/fase2-uploads.json');
const plan = JSON.parse(readFileSync(join(ROOT, 'data/assets-plan.json'), 'utf8')).plan;
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const tmp = mkdtempSync(join(tmpdir(), 'cm-f2-'));

function gql(query, variables = {}) {
  const q = join(tmp, 'q.graphql'), v = join(tmp, 'v.json'), o = join(tmp, 'o.json');
  writeFileSync(q, query); writeFileSync(v, JSON.stringify(variables));
  execFileSync('shopify', ['store', 'execute', '--store', STORE, '--allow-mutations', '--json', '--query-file', q, '--variable-file', v, '--output-file', o], { stdio: ['ignore', 'ignore', 'pipe'] });
  return JSON.parse(readFileSync(o, 'utf8'));
}

const SKIP_VIA = new Set(['app', 'admin-producto']);
const items = plan.filter((x) => !SKIP_VIA.has(x.via) && x.archivo_optimizado && existsSync(join(ROOT, x.archivo_optimizado)) && done[x.id]?.status !== 'READY');
console.log(`${items.length} por subir (${Object.keys(done).length} ya registrados)`);

for (let i = 0; i < items.length; i += 10) {
  const chunk = items.slice(i, i + 10).map((x) => {
    const path = join(ROOT, x.archivo_optimizado);
    const ext = extname(path).toLowerCase();
    const isVid = x.tipo === 'video';
    return { x, path, isVid, filename: `cm-${basename(path, ext)}${ext}`, mime: isVid ? 'video/mp4' : 'image/webp', size: statSync(path).size };
  });
  const st = gql(`mutation($input:[StagedUploadInput!]!){stagedUploadsCreate(input:$input){stagedTargets{url resourceUrl parameters{name value}} userErrors{field message}}}`,
    { input: chunk.map((c) => ({ filename: c.filename, mimeType: c.mime, resource: c.isVid ? 'VIDEO' : 'IMAGE', httpMethod: 'POST', fileSize: String(c.size) })) });
  const targets = st.stagedUploadsCreate.stagedTargets;
  if (st.stagedUploadsCreate.userErrors.length) throw new Error(JSON.stringify(st.stagedUploadsCreate.userErrors));
  chunk.forEach((c, k) => {
    const t = targets[k];
    const form = t.parameters.flatMap((p) => ['-F', `${p.name}=${p.value}`]);
    execFileSync('curl', ['-sS', '--fail', '-X', 'POST', ...form, '-F', `file=@${c.path}`, t.url], { stdio: ['ignore', 'ignore', 'pipe'] });
    c.resourceUrl = t.resourceUrl;
  });
  const fc = gql(`mutation($files:[FileCreateInput!]!){fileCreate(files:$files){files{id fileStatus} userErrors{field message}}}`,
    { files: chunk.map((c) => ({ originalSource: c.resourceUrl, contentType: c.isVid ? 'VIDEO' : 'IMAGE', filename: c.filename, alt: '' })) });
  if (fc.fileCreate.userErrors.length) throw new Error(JSON.stringify(fc.fileCreate.userErrors));
  fc.fileCreate.files.forEach((f, k) => { const c = chunk[k]; done[c.x.id] = { id: f.id, status: f.fileStatus, tipo: c.x.tipo, filename: c.filename, bytes: c.size }; });
  writeFileSync(OUT, JSON.stringify(done, null, 1));
  console.log(`  subidos ${Math.min(i + 10, items.length)}/${items.length}`);
}

// Esperar READY y leer URLs
for (let round = 0; round < 60; round++) {
  const pending = Object.entries(done).filter(([, v]) => v.status !== 'READY' && v.status !== 'FAILED');
  if (!pending.length) break;
  const r = gql(`query($ids:[ID!]!){nodes(ids:$ids){... on MediaImage{id fileStatus image{url}} ... on Video{id fileStatus filename originalSource{url} sources{url format height}} ... on File{fileErrors{message}}}}`,
    { ids: pending.map(([, v]) => v.id) });
  r.nodes.forEach((n) => {
    const e = Object.values(done).find((v) => v.id === n.id);
    e.status = n.fileStatus;
    if (n.image) { e.url = n.image.url; e.stored_name = decodeURIComponent(basename(new URL(n.image.url).pathname)); }
    if (n.originalSource) { e.url = n.originalSource.url; e.stored_name = n.filename; e.sources = n.sources; }
    if (n.fileErrors?.length) e.errors = n.fileErrors;
  });
  writeFileSync(OUT, JSON.stringify(done, null, 1));
  const left = Object.values(done).filter((v) => v.status !== 'READY' && v.status !== 'FAILED').length;
  console.log(`  ronda ${round}: ${left} procesando`);
  if (!left) break;
  execFileSync('sleep', ['10']);
}
const vals = Object.values(done);
console.log(`READY ${vals.filter((v) => v.status === 'READY').length} · FAILED ${vals.filter((v) => v.status === 'FAILED').length} · otros ${vals.filter((v) => !['READY', 'FAILED'].includes(v.status)).length}`);
