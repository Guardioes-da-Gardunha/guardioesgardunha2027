# Gera a animação "Como funciona" (SVG + CSS, 15 s em ciclo). Saída: anim/anim.svg.html (fragmento) e anim/anim.css
T = 20
SC1 = 8.0
def M(p): return ((p / 20 * SC1) if p <= 20 else (SC1 + (p - 20) / 80 * 12)) / T * 100   # p = escala antiga (0-100, cenas de 20)
K = []   # keyframes
R = []   # regras css
def kf(name, frames):
    K.append('@keyframes ga-%s{%s}' % (name, ''.join('%g%%{%s}' % (M(p), c) for p, c in frames)))
    R.append('.ga .%s{animation:ga-%s %ss linear infinite both}' % (name, name, T))
def vis(name, a, b, f=1.4):
    fr = [(0, 'opacity:0')] if a > 0 else []
    fr += [(a, 'opacity:0'), (a + f, 'opacity:1'), (b - f, 'opacity:1'), (b, 'opacity:0')]
    if b < 100: fr.append((100, 'opacity:0'))
    kf(name, fr)
def pop(name, a, origin='center'):
    kf(name, [(0, 'transform:scale(0)'), (a, 'transform:scale(0)'), (a + 1.6, 'transform:scale(1.18)'), (a + 2.6, 'transform:scale(1)'), (100, 'transform:scale(1)')])
    R.append('.ga .%s{transform-box:fill-box;transform-origin:%s}' % (name, origin))
def appear(name, a, b=100, f=.8): vis(name, a, b, f)


# ---- figura humana com bordão (pés na origem) ----
INK = 'var(--ga-ink)'
def limb(d, w=14): return '<path d="%s" fill="none" stroke="%s" stroke-width="%d" stroke-linecap="round" stroke-linejoin="round"/>' % (d, INK, w)
def staff(x1, y1, x2, y2): return ('<path d="M%g %g L%g %g" stroke="var(--ga-terra)" stroke-width="9" stroke-linecap="round"/><circle cx="%g" cy="%g" r="8" fill="var(--ga-terra)"/>' % (x1, y1, x2, y2, x1, y1))
def runner():
    base = staff(22, -170, 46, -4) + limb('M4 -112 L-6 -62', 17) + '<circle cx="10" cy="-131" r="16" fill="%s"/>' % INK + limb('M2 -104 L22 -88 L33 -99')
    a = '<g class="pa">' + limb('M-6 -62 L14 -36 L32 -10') + limb('M-6 -62 L-22 -36 L-40 -24') + limb('M2 -104 L-16 -88 L-30 -74') + '</g>'
    b = '<g class="pb">' + limb('M-6 -62 L6 -32 L0 0') + limb('M-6 -62 L-12 -34 L-2 -14') + limb('M2 -104 L-4 -84 L10 -72') + '</g>'
    return '<g transform="rotate(7)">' + staff(22, -170, 46, -4) + a + b + base + '</g>'
def victor():
    return (staff(34, -250, 30, -60) + limb('M0 -64 L-16 0') + limb('M0 -64 L16 0') + limb('M0 -116 L0 -64', 17) + '<circle cx="0" cy="-136" r="16" fill="%s"/>' % INK
            + limb('M0 -108 L22 -132 L31 -160') + limb('M0 -108 L-24 -130 L-34 -156'))
R.append('@keyframes ga-stA{0%{opacity:1}50%{opacity:0}100%{opacity:0}}@keyframes ga-stB{0%{opacity:0}50%{opacity:1}100%{opacity:1}}')
R.append('.ga .pa{animation:ga-stA .36s steps(1) infinite}.ga .pb{animation:ga-stB .36s steps(1) infinite}')

TRACE = "M300 640 C 380 620 420 585 470 560 S 560 540 600 500 S 640 430 700 420 S 800 400 830 350 S 880 280 960 262 S 1040 250 1090 228"
SHIELD = '<g stroke="currentColor" stroke-width="7" stroke-linecap="round"><path d="M14 132 L126 10"/><path d="M126 132 L14 10"/></g><circle cx="126" cy="10" r="6" fill="currentColor"/><circle cx="14" cy="10" r="6" fill="currentColor"/><path d="M70 20 L118 34 V72 C118 102 97 121 70 132 C43 121 22 102 22 72 V34 Z" fill="var(--ga-bg)" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><path d="M36 102 L56 68 L66 83 L78 59 L104 102 Z" fill="currentColor"/>'
S = []
S.append('<rect width="1600" height="900" fill="var(--ga-bg)"/>')
S.append('<g fill="none" stroke="var(--ga-cont)" stroke-width="2" opacity=".5">' + ''.join('<path d="M-20 %d C 300 %d, 700 %d, 1000 %d S 1450 %d, 1620 %d"/>' % (y, y-50, y+40, y-30, y-60, y-10) for y in range(120, 900, 110)) + '</g>')
S.append('<text x="100" y="104" class="ga-mono" font-size="28" fill="var(--ga-muted)" letter-spacing="4">GUARDIÕES DA GARDUNHA</text>')
# pontos de progresso
for i in range(5):
    S.append('<rect x="%d" y="86" width="52" height="10" rx="5" fill="var(--ga-line)"/>' % (1180 + i * 64))
    S.append('<rect class="pp%d" x="%d" y="86" width="52" height="10" rx="5" fill="var(--ga-terra)"/>' % (i, 1180 + i * 64)); vis('pp%d' % i, i * 20, i * 20 + 20, .6)


# ---- cena 1: montanha — a subir, a direito, a descer, e depois o percurso todo ----
PROF = [(130, 700), (600, 450), (1000, 450), (1470, 700)]      # partida, topo da subida, fim do plano, chegada
LAB = [('a subir', 0, 'start', 150), ('a direito', 1, 'middle', 800), ('a descer', 2, 'end', 1450)]
def lerp(A, B, t): return (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
PPATH = 'M%d %d L%d %d L%d %d L%d %d' % tuple(v for pt in PROF for v in pt)
S.append('<g class="mtn"><path d="M0 760 L260 520 L420 600 L640 330 L800 430 L1010 290 L1200 410 L1400 330 L1600 560 L1600 900 L0 900 Z" fill="var(--ga-line)" opacity=".7"/>'
         '<path d="M%d %d L%d %d L%d %d L%d %d L%d 760 L%d 760 Z" fill="var(--ga-s2)"/>' % (PROF[0][0], PROF[0][1], PROF[1][0], PROF[1][1], PROF[2][0], PROF[2][1], PROF[3][0], PROF[3][1], PROF[3][0], PROF[0][0]) +
         '<path d="%s" fill="none" stroke="var(--ga-line2)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>' % PPATH)
vis('mtn', 0, 20, .15)
# 3 segmentos (1,6 s cada) — a figura percorre cada um e o troço acende
for i, (lbl, k, anc, lx) in enumerate(LAB):
    A, B = PROF[k], PROF[k + 1]; a0, b0 = i * 4.5, (i + 1) * 4.5
    S.append('<g class="sl%d"><path d="M%d %d L%d %d" stroke="var(--ga-terra)" stroke-width="14" stroke-linecap="round"/>'
             '<text x="%d" y="205" text-anchor="%s" class="ga-head" font-size="110" fill="var(--ga-terra)">%s</text>'
             '<g class="mv%d"><g transform="scale(1.2)">%s</g></g></g>' % (i, A[0], A[1], B[0], B[1], lx, anc, lbl.upper(), i, runner()))
    vis('sl%d' % i, a0, b0, .15)
    p0, p1 = lerp(A, B, .1), lerp(A, B, .9)
    kf('mv%d' % i, [(0, 'transform:translate(%gpx,%gpx)' % (p0[0], p0[1] - 6)), (a0 + .2, 'transform:translate(%gpx,%gpx)' % (p0[0], p0[1] - 6)), (b0 - .2, 'transform:translate(%gpx,%gpx)' % (p1[0], p1[1] - 6)), (100, 'transform:translate(%gpx,%gpx)' % (p1[0], p1[1] - 6))])
# percurso completo (subida + plano + descida): meta axadrezada e partida, a figura corre tudo
FLAG = lambda x, y: '<g class="fl0"><path d="M%d %d v-86" stroke="var(--ga-ink)" stroke-width="6" stroke-linecap="round"/><path d="M%d %d h58 l-14 18 l14 18 h-58 Z" fill="var(--ga-terra)"/></g>' % (x, y, x, y - 86)
CHK = lambda x, y: '<g class="fl1"><path d="M%d %d v-100" stroke="var(--ga-ink)" stroke-width="6" stroke-linecap="round"/>' % (x, y) + ''.join('<rect x="%d" y="%d" width="20" height="20" fill="%s"/>' % (x + c * 20, y - 100 + r * 20, 'var(--ga-ink)' if (r + c) % 2 == 0 else 'var(--ga-bg)') for r in range(2) for c in range(3)) + '<rect x="%d" y="%d" width="60" height="40" fill="none" stroke="var(--ga-ink)" stroke-width="3"/></g>' % (x, y - 100)
S.append('<g class="rt"><path d="%s" fill="none" stroke="var(--ga-terra)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>' % PPATH +
         '<path d="%s" fill="none" stroke="var(--ga-ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="1000" class="rdone"/>' % PPATH +
         FLAG(*PROF[0]) + CHK(*PROF[3]) +
         '<text x="800" y="205" text-anchor="middle" class="ga-head" font-size="110" fill="var(--ga-terra)">O PERCURSO</text>' +
         '<g class="rr"><animateMotion dur="%ss" repeatCount="indefinite" path="%s" keyPoints="0;0;1;1" keyTimes="0;%.4f;%.4f;1" calcMode="linear"/><g transform="translate(0 -6) scale(1.1)">%s</g></g></g>' % (T, PPATH, M(13.9)/100, M(19.2)/100, runner()))
vis('rt', 13.5, 20, .2)
kf('rdone', [(0, 'stroke-dasharray:1000;stroke-dashoffset:1000'), (13.9, 'stroke-dashoffset:1000'), (19.2, 'stroke-dashoffset:0'), (100, 'stroke-dasharray:1000;stroke-dashoffset:0')])
R.append('.ga .rr{opacity:1}')

# ---- cenas 1–2: mapa ----
m = ['<g class="map">',
     '<path d="M140 760 L330 560 L430 610 L600 400 L720 470 L880 260 L1000 330 L1120 280 L1240 760 Z" fill="var(--ga-s2)" opacity=".75"/>',
     '<path d="%s" fill="none" stroke="var(--ga-bg)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" class="draw" pathLength="1000"/>' % TRACE,
     '<path d="%s" fill="none" stroke="var(--ga-terra)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" class="draw" pathLength="1000"/>' % TRACE,
     '<path d="%s" fill="none" stroke="var(--ga-ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="done" pathLength="1000"/>' % TRACE,
     '<g class="fst"><path d="M300 640 V560" stroke="var(--ga-ink)" stroke-width="6" stroke-linecap="round"/><path d="M300 562 h58 l-14 18 l14 18 h-58 Z" fill="var(--ga-terra)"/></g>',
     '<g class="ffi"><path d="M1090 228 V140" stroke="var(--ga-ink)" stroke-width="6" stroke-linecap="round"/>' + ''.join('<rect x="%d" y="%d" width="20" height="20" fill="%s"/>' % (1090 + c * 20, 142 + r * 20, 'var(--ga-ink)' if (r + c) % 2 == 0 else 'var(--ga-bg)') for r in range(2) for c in range(3)) + '<rect x="1090" y="142" width="60" height="40" fill="none" stroke="var(--ga-ink)" stroke-width="3"/></g>',
     '<g class="run"><animateMotion dur="%ss" repeatCount="indefinite" path="%s" keyPoints="0;0;1;1" keyTimes="0;%.4f;%.4f;1" calcMode="linear"/><g transform="scale(.72)">%s</g></g>' % (T, TRACE, M(25)/100, M(38.5)/100, runner()),
     '</g>']
S += m
vis('map', 20, 40); kf('draw', [(0, 'stroke-dasharray:1000;stroke-dashoffset:1000'), (20.5, 'stroke-dashoffset:1000'), (25, 'stroke-dashoffset:0'), (100, 'stroke-dasharray:1000;stroke-dashoffset:0')])
kf('done', [(0, 'stroke-dasharray:1000;stroke-dashoffset:1000'), (25, 'stroke-dashoffset:1000'), (38.5, 'stroke-dashoffset:0'), (100, 'stroke-dasharray:1000;stroke-dashoffset:0')])
pop('fst', 20.5, 'left bottom'); pop('ffi', 24.5, 'left bottom'); vis('run', 24.5, 40, .8)

# ---- cenas 2–3: relógio ----
w = ['<g class="watch">',
     '<rect x="1240" y="170" width="140" height="120" rx="20" fill="var(--ga-s2)"/><rect x="1240" y="570" width="140" height="120" rx="20" fill="var(--ga-s2)"/>',
     '<circle cx="1310" cy="430" r="150" fill="var(--ga-s1)" stroke="var(--ga-line2)" stroke-width="8"/>',
     '<circle cx="1310" cy="430" r="128" fill="none" stroke="var(--ga-line)" stroke-width="12"/>',
     '<circle cx="1310" cy="430" r="128" fill="none" stroke="var(--ga-terra)" stroke-width="12" stroke-linecap="round" pathLength="1000" class="ring" transform="rotate(-90 1310 430)"/>']
for i, (t, a, b) in enumerate([('0:00', 20, 27.5), ('4:21', 27.5, 31), ('8:47', 31, 35), ('12:34', 35, 60)]):
    w.append('<text x="1310" y="448" text-anchor="middle" class="ga-mono wt%d" font-size="62" font-weight="700" fill="var(--ga-ink)">%s</text>' % (i, t)); appear('wt%d' % i, a, b, .3)
w.append('<g class="rec"><circle cx="1268" cy="500" r="9" fill="#E58A78"/><text x="1286" y="510" class="ga-mono" font-size="28" fill="var(--ga-muted)">REC</text></g>')
w.append('</g>')
S += w
vis('watch', 20, 60); kf('ring', [(0, 'stroke-dasharray:1000;stroke-dashoffset:1000'), (25, 'stroke-dashoffset:1000'), (38.5, 'stroke-dashoffset:0'), (100, 'stroke-dasharray:1000;stroke-dashoffset:0')])
kf('rec', [(0, 'opacity:1'), (25, 'opacity:1'), (26.5, 'opacity:.15'), (28, 'opacity:1'), (29.5, 'opacity:.15'), (31, 'opacity:1'), (32.5, 'opacity:.15'), (34, 'opacity:1'), (35.5, 'opacity:.15'), (37, 'opacity:1'), (38.5, 'opacity:0'), (100, 'opacity:0')])

# ---- cena 3: ficheiro ----
S.append('<g class="tray"><path d="M720 660 v70 h320 v-70" fill="none" stroke="var(--ga-terra)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>')
S.append('<g class="arr"><path d="M880 540 v80 M845 585 l35 35 35-35" fill="none" stroke="var(--ga-ink)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>')
S.append('<g class="card"><path d="M760 200 h180 l60 60 v260 h-240 Z" fill="var(--ga-ink)"/><path d="M940 200 v60 h60" fill="var(--ga-muted)"/>'
         '<text x="880" y="380" text-anchor="middle" class="ga-head" font-size="96" fill="var(--ga-bg)">GPX</text><text x="880" y="440" text-anchor="middle" class="ga-mono" font-size="26" fill="var(--ga-s2)">ou FIT</text></g>')
vis('tray', 41, 60); vis('arr', 47, 58, .6)
kf('arr', [(0, 'opacity:0;transform:translateY(-30px)'), (47, 'opacity:0;transform:translateY(-30px)'), (48.5, 'opacity:1;transform:translateY(0)'), (50, 'opacity:1;transform:translateY(-16px)'), (51.5, 'opacity:1;transform:translateY(0)'), (53, 'opacity:1;transform:translateY(-16px)'), (54.5, 'opacity:1;transform:translateY(0)'), (57, 'opacity:0'), (100, 'opacity:0')])
kf('card', [(0, 'opacity:0;transform:translate(430px,120px) scale(.2)'), (41, 'opacity:0;transform:translate(430px,120px) scale(.2)'), (42, 'opacity:1'), (46, 'opacity:1;transform:translate(0,-20px) scale(1)'), (53, 'opacity:1;transform:translate(0,-20px) scale(1)'), (56.5, 'opacity:1;transform:translate(0,300px) scale(.3)'), (58, 'opacity:0;transform:translate(0,330px) scale(.25)'), (100, 'opacity:0')])
R.append('.ga .card{transform-box:fill-box;transform-origin:center}')

# ---- cena 4: telemóvel ----
p = ['<g class="phone"><g transform="translate(400 -20)">',
     '<rect x="620" y="140" width="360" height="640" rx="48" fill="var(--ga-s1)" stroke="var(--ga-line2)" stroke-width="8"/>',
     '<rect x="740" y="160" width="120" height="16" rx="8" fill="var(--ga-line2)"/>',
     '<text x="660" y="236" class="ga-mono" font-size="26" fill="var(--ga-terra)" letter-spacing="2">A MINHA ÁREA</text>',
     '<rect x="656" y="260" width="288" height="70" rx="14" fill="var(--ga-bg)" stroke="var(--ga-line2)" stroke-width="3"/>',
     '<text x="676" y="306" class="ga-body" font-size="30" font-weight="600" fill="var(--ga-ink)">Ana · Alpedrinha</text>',
     '<text x="660" y="380" class="ga-mono" font-size="24" fill="var(--ga-muted)">PIN</text>']
for i in range(5):
    cx = 690 + i * 55
    p.append('<circle cx="%d" cy="418" r="17" fill="none" stroke="var(--ga-line2)" stroke-width="4"/>' % cx)
    p.append('<circle cx="%d" cy="418" r="13" fill="var(--ga-terra)" class="pin%d"/>' % (cx, i)); pop('pin%d' % i, 62 + i * .9)
p += ['<rect x="656" y="462" width="288" height="170" rx="16" fill="none" stroke="var(--ga-terra)" stroke-width="4" stroke-dasharray="14 10"/>',
      '<g class="mini"><path d="M760 492 h60 l20 20 v90 h-80 Z" fill="var(--ga-ink)"/><text x="800" y="572" text-anchor="middle" class="ga-head" font-size="30" fill="var(--ga-bg)">GPX</text></g>',
      '<rect x="656" y="660" width="288" height="18" rx="9" fill="var(--ga-line)"/>',
      '<rect x="656" y="660" width="288" height="18" rx="9" fill="var(--ga-terra)" class="bar"/>',
      '<g class="ok"><circle cx="800" cy="728" r="30" fill="var(--ga-terra)"/><path d="M786 728 l10 10 18-20" fill="none" stroke="var(--ga-bg)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>',
      '</g></g>']
S += p
vis('phone', 60, 80)
kf('mini', [(0, 'opacity:0;transform:translate(-1000px,-120px) rotate(-14deg)'), (67, 'opacity:0;transform:translate(-1000px,-120px) rotate(-14deg)'), (68, 'opacity:1'), (71.5, 'opacity:1;transform:translate(0,0) rotate(0)'), (100, 'opacity:1;transform:translate(0,0) rotate(0)')])
kf('bar', [(0, 'transform:scaleX(0)'), (72, 'transform:scaleX(0)'), (76.5, 'transform:scaleX(1)'), (100, 'transform:scaleX(1)')]); R.append('.ga .bar{transform-box:fill-box;transform-origin:left center}')
pop('ok', 77)

# ---- cena 5: pódio e bordão ----
q = ['<g class="pod">',
     '<rect x="200" y="700" width="600" height="10" rx="5" fill="var(--ga-line2)"/>',
     '<g class="p2"><rect x="240" y="530" width="160" height="170" rx="10" fill="var(--ga-ink)"/><text x="320" y="650" text-anchor="middle" class="ga-head" font-size="100" fill="var(--ga-bg)">2</text></g>',
     '<g class="p1"><rect x="420" y="450" width="160" height="250" rx="10" fill="var(--ga-terra)"/><text x="500" y="610" text-anchor="middle" class="ga-head" font-size="130" fill="var(--ga-bg)">1</text></g>',
     '<g class="p3"><rect x="600" y="590" width="160" height="110" rx="10" fill="var(--ga-line2)"/><text x="680" y="680" text-anchor="middle" class="ga-head" font-size="80" fill="var(--ga-ink)">3</text></g>',
     '<g class="crest"><g transform="translate(500 450) scale(1.25)">' + victor() + '</g></g>',
     '<text x="880" y="420" class="ga-head h1" font-size="118" fill="var(--ga-ink)">ROUBASTE</text>',
     '<text x="880" y="530" class="ga-head h1" font-size="118" fill="var(--ga-ink)">O BORDÃO.</text>',
     '<text x="880" y="660" class="ga-head h2" font-size="118" fill="var(--ga-terra)">ÉS GUARDIÃO.</text>',
     '</g>']
S += q
vis('pod', 80, 100)
for n, a in (('p2', 81), ('p1', 82), ('p3', 83)):
    kf(n, [(0, 'transform:scaleY(0)'), (a, 'transform:scaleY(0)'), (a + 3, 'transform:scaleY(1)'), (100, 'transform:scaleY(1)')]); R.append('.ga .%s{transform-box:fill-box;transform-origin:center bottom}' % n)
kf('crest', [(0, 'opacity:0;transform:translateY(-420px)'), (86, 'opacity:0;transform:translateY(-420px)'), (86.5, 'opacity:1'), (88.5, 'opacity:1;transform:translateY(0)'), (89.3, 'transform:translateY(-26px)'), (90, 'transform:translateY(0)'), (100, 'opacity:1;transform:translateY(0)')])
appear('h1', 89.5); appear('h2', 91.5)
# move o cabeçalho do pódio para baixo dos títulos: o escudo cai até ao 1.º lugar
# ---- legendas ----
CAP = ['Escolhe um caminho', 'Grava a tua corrida', 'Descarrega o ficheiro', 'Entra na tua área e carrega', 'Vê onde ficaste']
for i, t in enumerate(CAP):
    S.append('<g class="cap%d"><circle cx="146" cy="812" r="46" fill="var(--ga-terra)"/><text x="146" y="840" text-anchor="middle" class="ga-head" font-size="80" fill="var(--ga-bg)">%d</text>'
             '<text x="218" y="842" class="ga-head" font-size="80" fill="var(--ga-ink)">%s</text></g>' % (i, i + 1, t.upper()))
    vis('cap%d' % i, i * 20, i * 20 + 20, 1)
svg = '<svg class="ga" viewBox="0 0 1600 900" role="img" aria-label="Como participar: escolhe um caminho, grava a corrida, descarrega o ficheiro, carrega na tua área e vê onde ficaste.">' + ''.join(S) + '</svg>'
css = ('.ga{display:block;width:100%;height:100%;--ga-bg:var(--bg,#141614);--ga-s1:var(--surface,#1D201D);--ga-s2:var(--surface2,#262A25);--ga-ink:var(--ink,#ECEEE6);--ga-muted:var(--muted,#9BA197);'
       '--ga-line:var(--line,#2C302B);--ga-line2:var(--line2,#3D433B);--ga-terra:var(--terra,#8FB573);--ga-cont:#2A2E29}'
       '.ga .ga-head{font-family:var(--head,Archivo),sans-serif;font-weight:900;font-stretch:62%}.ga .ga-mono{font-family:var(--mono,"JetBrains Mono"),monospace}.ga .ga-body{font-family:var(--body,Archivo),sans-serif}'
       + ''.join(K) + ''.join(R) +
       '@media (prefers-reduced-motion: reduce){.ga *{animation-delay:-19.9s!important;animation-play-state:paused!important}}')
open('anim/anim.svg', 'w').write(svg); open('anim/anim.css', 'w').write(css)
print(len(svg), len(css))
