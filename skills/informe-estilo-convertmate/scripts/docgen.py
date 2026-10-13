"""docgen: documentos al cliente con la identidad visual de quotes.convertmate.co.
Uso:
    import sys, os; sys.path.insert(0, os.path.expanduser('~/.claude/skills/informe-estilo-convertmate/scripts'))
    from docgen import *
    html = documento(titulo_pestana, hero(...), indice([...]), section(...), ..., cliente='Marca')
    open('salida.html','w').write(html)
"""
import os,re
BASE=os.path.join(os.path.dirname(os.path.abspath(__file__)),'estilo-base.html')
FUENTES=('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
 '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400..600&display=swap" rel="stylesheet">'
 "<style>:root,body,.doc-auditoria{--font-geist:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--font-geist-mono:'Geist Mono',monospace}</style>")

def _base():
    s=open(BASE).read()
    head,rest=s.split('\n<!--BODYTAG-->',1)
    bodytag,rest=rest.split('\n<!--HEADER-->',1)
    header,rest=rest.split('\n<!--LOGOS-->',1)
    logos=rest.split('\n<!--FIN-->',1)[0]
    return head,bodytag,header,logos

def metric(k,v,chip=None,notes=()):
    o=f'<div class="res-metric"><span class="res-k">{k}</span><span class="res-v">{v}</span>'
    if chip: o+=f'<span class="base-linea" style="display:inline-flex;align-items:center;gap:5px;margin-top:7px;border-radius:999px;background:var(--n-100);color:var(--n-600);padding:3px 10px;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums">{chip}</span>'
    for n in notes: o+=f'<span class="base-linea" style="display:block;margin-top:6px;line-height:1.5;color:var(--n-500)">{n}</span>'
    return o+'</div>'
def metrics(items): return '<div style="margin-top:16px;border:1px solid var(--n-100);border-radius:14px;overflow:hidden"><div class="res-metrics" style="border-bottom:none">'+''.join(items)+'</div></div>'
def table(headers,rows,num=()):
    NUM=' class="num"'  # fuera de la f-string: Python < 3.12 no admite backslash dentro
    h='<div class="tabla-scroll"><table class="res-tabla" style="margin-top:16px"><thead><tr>'+''.join(f'<th{NUM if i in num else ""}>{x}</th>' for i,x in enumerate(headers))+'</tr></thead><tbody>'
    for r in rows: h+='<tr>'+''.join(f'<td{NUM if i in num else ""}>{x}</td>' for i,x in enumerate(r))+'</tr>'
    return h+'</tbody></table></div>'
def card(title,*ps):
    o=f'<div class="brand-card" style="margin-top:18px"><div class="fuente-name">{title}</div>'
    for i,p in enumerate(ps): o+=f'<p class="prosa-larga" style="margin-top:{8 if i==0 else 10}px;font-size:15px;line-height:1.7;color:var(--n-900)">{p}</p>'
    return o+'</div>'
def learn(k,v,pills=()):
    o=f'<div class="res-learn"><span class="res-learn-k">{k}</span><span class="res-learn-v">{v}</span>'
    if pills: o+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+''.join(f'<span class="{c} pill-larga">{t}</span>' for c,t in pills)+'</div>'
    return o+'</div>'
def learns(items): return '<div style="display:grid;grid-template-columns:minmax(0, 1fr);gap:12px;margin-top:12px">'+''.join(items)+'</div>'
def section(id,eyebrow,title,desc,inner):
    d=''.join(f'<p class="section-desc prosa-larga">{x}</p>' for x in ([desc] if isinstance(desc,str) else desc))
    return f'<section class="doc-section" id="{id}"><span class="eyebrow">{eyebrow}</span><h2 class="section-title">{title}</h2>{d}{inner}</section>'
def ol(items): return '<ol class="lista-sigue">'+''.join(f'<li>{x}</li>' for x in items)+'</ol>'


def hero(pill,titulo,bajada,cliente,dominio,pais='Colombia',fecha='',chips=()):
    c=''.join(f'<span class="{cl}">{t}</span>' for cl,t in chips)
    f=f'<span class="pill-neutral">{fecha}</span>' if fecha else ''
    return (f'<section class="doc-hero"><span class="hero-pill">{pill}</span><h1>{titulo}</h1>'
            f'<p style="margin-top:14px;font-size:16px;line-height:1.65;color:var(--n-600)">{bajada}</p>'
            f'<div class="subline"><span>Preparado para <strong>{cliente}</strong></span><span>{dominio}</span><span>{pais}</span>{f}</div>'
            + (f'<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px">{c}</div>' if c else '') + '</section>')

def indice(items):
    """items: [(id_seccion, titulo)]"""
    return ('<nav aria-label="Contenido del documento" style="margin-top:28px;border:1px solid var(--n-100);border-radius:16px;background:rgba(250, 250, 250, 0.5);padding:18px 20px"><div class="fuente-name">Lo que hay adentro</div><ol style="margin-top:12px;display:grid;gap:8px 20px;grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));list-style:none">'
            + ''.join(f'<li style="font-size:13.5px;line-height:1.5;color:var(--n-600)"><a href="#{a}" style="border-bottom:1px solid var(--n-200)"><span style="display:inline-block;min-width:20px;color:var(--n-400);font-variant-numeric:tabular-nums">{i+1}.</span> {t}</a></li>' for i,(a,t) in enumerate(items))
            + '</ol></nav>')

def atribucion(titulo,texto):
    return f'<section class="doc-section"><div class="brand-card atribucion"><div class="fuente-name">{titulo}</div><p>{texto}</p></div></section>'

def documento(titulo_pestana,*bloques,cliente):
    head,bodytag,header,logos=_base()
    head=re.sub(r'<title>.*?</title>',f'<title>{titulo_pestana}</title>',head,flags=re.S)
    head=head.replace('</head>','<meta name="robots" content="noindex,nofollow">'+FUENTES+'</head>',1)
    footer=f'<footer class="doc-footer"><span>Preparado por <strong style="color:var(--n-900)">ConvertMate</strong>, equipo CRO</span><span>Documento confidencial para {cliente}</span></footer>'
    out=head+bodytag+'<div class="doc-auditoria" style="min-height:100dvh;background:#fff">'+header+'<main class="doc-container">'+''.join(bloques)+logos+footer+'</main></div></body></html>'
    prosa=re.sub(r'<style.*?</style>','',out.split('<body',1)[1],flags=re.S)
    if '—' in prosa: raise ValueError('Hay una raya (—) en el texto: cámbiala por coma o punto')
    return out
