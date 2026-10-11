#!/usr/bin/env python3
"""Gera public/index.html a partir de src/app.html + src/core.js; copia src/adapter.js para public/.
Uso: python3 build.py   (sem dependências)"""
import re, shutil
core = open('src/core.js', encoding='utf-8').read()
names = re.search(r"module\.exports = \{([^}]*)\}", core).group(1)
wrapped = "const C = (function(){\n" + core + "\nreturn {" + names + "};\n})();"
src = open('src/app.html', encoding='utf-8').read().replace('/*CORE*/', wrapped)

# regulamento: src/regulamento.md -> const REG = [{t, html}]
import html as H, json
def inline(t):
    t = H.escape(t, quote=False)
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
def md2html(lines):
    out, i = [], 0
    while i < len(lines):
        l = lines[i]
        if not l.strip(): i += 1; continue
        if l.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            th = ''.join('<th>' + inline(c) + '</th>' for c in rows[0])
            tb = ''.join('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in r) + '</tr>' for r in rows[1:])
            out.append('<div class="tw"><table><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table></div>'); continue
        if l.startswith('- '):
            items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append('<li>' + inline(lines[i][2:].strip()) + '</li>'); i += 1
            out.append('<ul>' + ''.join(items) + '</ul>'); continue
        out.append('<p>' + inline(l.strip()) + '</p>'); i += 1
    return ''.join(out)
REG, cur = [], None
for line in open('src/regulamento.md', encoding='utf-8').read().split('\n'):
    if line.startswith('## '):
        cur = {'t': line[3:].strip(), 'lines': []}; REG.append(cur)
    elif cur is not None:
        cur['lines'].append(line)
reg_js = 'const REG = ' + json.dumps([{'t': a['t'], 'html': md2html(a['lines'])} for a in REG], ensure_ascii=False).replace('</', '<\\/') + ';'
assert src.count('/*REG*/') == 1
src = src.replace('/*REG*/', reg_js)
icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'%3E%3Crect width='140' height='140' rx='24' fill='%231D0E12'/%3E%3Cg stroke='%23D8B25A' stroke-width='9' stroke-linecap='round'%3E%3Cpath d='M26 118 L114 22'/%3E%3Cpath d='M114 118 L26 22'/%3E%3C/g%3E%3C/svg%3E"
head = ('<!doctype html>\n<html lang="pt-PT">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="theme-color" content="#1D0E12">\n<meta name="description" content="Guardiões da Gardunha 2027 — desafio de trail na Serra da Gardunha. Inscrições, caminhos, classificações.">\n'
        '<meta property="og:title" content="Guardiões da Gardunha 2027"><meta property="og:description" content="Rouba o bordão. Desafio de trail na Serra da Gardunha.">\n'
        '<link rel="icon" href="' + icon + '">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Guardiões">\n')
assert src.count('<header>') == 1 and src.count('<script>') == 2
src = src.replace('<header>', '</head>\n<body>\n<header>', 1)
src = src.replace('<script>\n', '<script src="config.js"></script>\n<script src="adapter.js"></script>\n<script>\n', 1)
open('public/index.html', 'w', encoding='utf-8').write(head + src + '\n</body>\n</html>\n')
shutil.copy('src/adapter.js', 'public/adapter.js')
# cópia em docs/ para o GitHub Pages (que só publica a raiz ou a pasta docs/)
import os
PUBFILES = [f for f in ('index.html', 'adapter.js', 'config.js', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png') if os.path.exists('public/' + f)]
os.makedirs('docs', exist_ok=True)
for f in PUBFILES: shutil.copy('public/' + f, 'docs/' + f)
open('docs/.nojekyll', 'w').close()
# e na raiz, para o GitHub Pages funcionar com a pasta / (root) ou /docs
for f in PUBFILES: shutil.copy('public/' + f, f)
open('.nojekyll', 'w').close()
print('public/index.html', len(head + src))
