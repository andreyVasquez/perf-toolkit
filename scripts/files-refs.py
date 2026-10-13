#!/usr/bin/env python3
"""Fase 2: reemplaza en theme/ las referencias a los assets originales por los subidos (data/fase2-uploads.json)."""
import json, re, os, sys, urllib.parse
ROOT = os.getcwd()  # correr desde la carpeta del proyecto; --dry para solo listar
T = os.path.join(ROOT, 'theme')
plan = {x['id']: x for x in json.load(open(os.path.join(ROOT, 'data/assets-plan.json')))['plan']}
up = json.load(open(os.path.join(ROOT, 'data/fase2-uploads.json')))

def load_json(p):
    s = open(p).read(); i = s.find('{'); return s[:i], json.loads(s[i:])

def get_path(rel, dotted):
    _, d = load_json(os.path.join(T, rel))
    for k in dotted.split('.'): d = d[k]
    return d

files = {}
def text(rel):
    if rel not in files: files[rel] = open(os.path.join(T, rel)).read()
    return files[rel]

all_rel = [os.path.join(dp, f)[len(T)+1:] for dp, _, fs in os.walk(T) for f in fs if f.endswith(('.liquid', '.json', '.css'))]
log = []
for pid, u in up.items():
    x = plan[pid]; new = u['url'].split('?')[0]; stored = u['stored_name']
    asset = x['asset']  # sin protocolo
    tail = asset.split('/', 1)[1] if '/' in asset else asset
    fname = urllib.parse.unquote(asset.rsplit('/', 1)[1])
    pats = []  # (regex, replacement)
    if x['tipo'] == 'video':
        if '/videos/c/o/v/' in asset:
            pats.append((r'(?:https?:)?//cdn\.shopify\.com/videos/c/o/v/' + re.escape(fname), new))
        for r in x['refs']:
            if ':' in r and '.json:' in r:
                rel, dotted = r.split(':', 1)
                old = get_path(rel, dotted)
                if isinstance(old, str) and old.startswith('shopify://files/videos/'):
                    pats.append((re.escape('"' + old + '"'), '"shopify://files/videos/' + stored + '"'))
    else:
        if '/cdn/shop/files/' in asset or 'cdn.shopify.com/s/files/' in asset:
            for nm in {fname, urllib.parse.quote(fname)}:
                pats.append((re.escape('shopify://shop_images/' + nm) + r'(?=")', 'shopify://shop_images/' + stored))
                pats.append((r'(?:https?:)?//[^\s"\'()<>]*?/files/' + re.escape(nm) + r'(?![\w.-])', new))
                pats.append((r"(['\"])" + re.escape(nm) + r"\1(\s*\|\s*(?:file_url|file_img_url|img_url))", r"\g<1>" + stored + r"\g<1>\2"))
        else:  # instant.so u otro CDN: URL literal
            pats.append((r'(?:https?:)?//' + re.escape(asset) + r'(?![\w.-])', new))
    n_tot = 0
    for rel in all_rel:
        s = text(rel); s0 = s
        for rx, rep in pats:
            s = re.sub(rx, rep.replace('\\', '\\\\') if '\\1' not in rep else rep, s)
        if s != s0:
            n = sum(len(re.findall(rx, s0)) for rx, _ in pats); n_tot += n
            files[rel] = s; log.append(f'{pid} {rel} x{n}')
    if not n_tot: log.append(f'{pid} SIN REFERENCIAS ({asset})')
dry = '--dry' in sys.argv
for rel, s in files.items():
    if not dry and s != open(os.path.join(T, rel)).read():
        open(os.path.join(T, rel), 'w').write(s)
print('\n'.join(log))
