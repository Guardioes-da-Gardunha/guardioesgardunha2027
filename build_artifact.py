#!/usr/bin/env python3
"""Gera a versão para o artefacto do claude.ai (usa a base de dados do próprio claude.ai, sem Supabase).
Saída: o caminho passado como argumento (por omissão artifact.html)."""
import re, sys, subprocess
subprocess.run([sys.executable, 'build.py'], check=True, capture_output=True)
html = open('public/index.html', encoding='utf-8').read()
# só o conteúdo do <head> próprio da app (título, fontes, estilos) + corpo; o artefacto acrescenta o esqueleto
head = html.split('<head>', 1)[1].split('</head>', 1)[0]
head = head[head.index('<title>'):]                      # sem metas/manifesto do site
body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
body = body.replace('<script src="config.js"></script>\n<script src="adapter.js"></script>\n', '')
def r(a, b):
    global body
    assert body.count(a) == 1, a[:60]; body = body.replace(a, b)
r("  S.db = db; S.user = user; S.dl = dl;", "  S.db = db; S.user = user ? artUser(user) : null; S.dl = dl;")
r("function installBox(){", "function installBox(){ const el0 = document.getElementById('install'); if (el0) el0.replaceChildren(); return;")
r("function orgFooter(){", "function orgFooter(){ const f0 = document.getElementById('foot'); if (f0) f0.replaceChildren(); return;")
r("loginBox())", "null)")
r("    else out.push(whoCard());", "    else out.push(h('div',{class:'card notice w'}, 'Inscreve-te primeiro no separador Inscrição; quando a organização aprovar, carregas aqui as tuas atividades.'));")
r("/* ===== Navegação, Início, cartões, mapa, regulamento ===== */", """/* artefacto claude.ai: identidade = conta claude.ai, organização = quem pode editar */
function artUser(u){ return {id:()=>u.id(), canEdit:()=>u.canEdit(), isOwner:()=>u.isOwner(), profiles:ids=>u.profiles(ids), ensure:()=>u.id(), newCode:async()=>null, adminNewCode:async()=>null, loginCode:async()=>false, claimAdmin:async()=>false, leaveAdmin:async()=>{}, setPin:async()=>true, pinStatus:async()=>'definido', pinLogin:async()=>false, adminSetPin:async()=>true, signOut:async()=>{}}; }
/* ===== Navegação, Início, cartões, mapa, regulamento ===== */""")
out = sys.argv[1] if len(sys.argv) > 1 else 'artifact.html'
open(out, 'w', encoding='utf-8').write(head + body)
print(out, len(head + body))
