#!/usr/bin/env python3
"""Gera public/index.html a partir de src/app.html + src/core.js; copia src/adapter.js para public/.
Uso: python3 build.py   (sem dependências)"""
import re, shutil
core = open('src/core.js', encoding='utf-8').read()
names = re.search(r"module\.exports = \{([^}]*)\}", core).group(1)
wrapped = "const C = (function(){\n" + core + "\nreturn {" + names + "};\n})();"
src = open('src/app.html', encoding='utf-8').read().replace('/*CORE*/', wrapped)
icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'%3E%3Crect width='140' height='140' rx='24' fill='%231D0E12'/%3E%3Cg stroke='%23D8B25A' stroke-width='9' stroke-linecap='round'%3E%3Cpath d='M26 118 L114 22'/%3E%3Cpath d='M114 118 L26 22'/%3E%3C/g%3E%3C/svg%3E"
head = ('<!doctype html>\n<html lang="pt-PT">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="theme-color" content="#1D0E12">\n<meta name="description" content="Guardiões da Gardunha 2027 — desafio de trail na Serra da Gardunha. Inscrições, caminhos, classificações.">\n'
        '<meta property="og:title" content="Guardiões da Gardunha 2027"><meta property="og:description" content="Rouba o bordão. Desafio de trail na Serra da Gardunha.">\n'
        '<link rel="icon" href="' + icon + '">\n')
assert src.count('<header>') == 1 and src.count('<script>') == 2
src = src.replace('<header>', '</head>\n<body>\n<header>', 1)
src = src.replace('<script>\n', '<script src="config.js"></script>\n<script src="adapter.js"></script>\n<script>\n', 1)
open('public/index.html', 'w', encoding='utf-8').write(head + src + '\n</body>\n</html>\n')
shutil.copy('src/adapter.js', 'public/adapter.js')
print('public/index.html', len(head + src))
