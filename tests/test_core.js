const C = require('../src/core.js');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.5;
function curve(u) { // trajeto de referência: 900 m, com curvas, em metros locais
  const x = u * 800, y = 120 * Math.sin(u * 6.0) + u * 60; return [x, y];
}
function pathPts(n, f) { const a = []; for (let i = 0; i <= n; i++) a.push(f(i / n)); return a; }
const refXY = pathPts(300, curve);
function lenOf(a) { let L = 0; for (let i = 1; i < a.length; i++) L += Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1]); return L; }
const REFLEN = lenOf(refXY);
// trace guardado (lat/lon, 5 casas)
const OFF = [-600, -200];
const traceFlat = []; refXY.forEach(([x, y]) => { const [la, lo] = C.unproj(x + OFF[0], y + OFF[1]); traceFlat.push(Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5); });
// atividade: caminho de aproximação, passagem pelo segmento (a v m/s), regresso, e uma 2.ª passagem mais rápida
let ex=0,ey=0; function noise(){ ex=0.95*ex+0.8*gauss(); ey=0.95*ey+0.8*gauss(); return [ex,ey]; }
let TIMES=[];
function buildActivity(passes, reverse2) {
  TIMES=[];
  const xy = []; let t = Date.parse('2026-10-10T08:00:00Z') / 1000; const out = []; let cur = [OFF[0] - 400, OFF[1] - 300];
  function go(to, v) { const d = Math.hypot(to[0] - cur[0], to[1] - cur[1]); const n = Math.max(2, Math.round(d / v)); for (let i = 1; i <= n; i++) { cur2 = [cur[0] + (to[0] - cur[0]) * i / n, cur[1] + (to[1] - cur[1]) * i / n]; push(cur2, v); } cur = to; }
  let cur2, onSeg = false, ele = 700; function push(p, v) { const nz=noise(); if (onSeg) ele = 700 + (p[0] - OFF[0]) * 0.1; out.push({ p: [p[0] + nz[0], p[1] + nz[1]], t: t, e: ele + nz[0] * 0.05 }); t += 1; }
  push(cur, 3);
  for (const { v, rev } of passes) {
    const pts = refXY.map(([x, y]) => [x + OFF[0], y + OFF[1]]); if (rev) pts.reverse();
    go(pts[0], 3);
    const tStart=t; onSeg = !rev;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); const n = Math.max(1, Math.round(d / v)); for (let k = 1; k <= n; k++) { const q = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / n, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / n]; push(q, v); } }
    TIMES.push(t - tStart); onSeg = false;
    cur = pts[pts.length - 1];
    go([cur[0] + 500, cur[1] - 400], 3);
  }
  let gpx = '<?xml version="1.0"?><gpx xmlns:gpxtpx="x"><trk><name>Treino de teste</name><type>running</type><trkseg>';
  for (const o of out) { const [la, lo] = C.unproj(o.p[0], o.p[1]); gpx += `<trkpt lat="${la.toFixed(6)}" lon="${lo.toFixed(6)}"><ele>${o.e.toFixed(1)}</ele><time>${new Date(o.t * 1000).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`; }
  return gpx + '</trkseg></trk></gpx>';
}
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) fails++; };
const act = C.parseGPX(buildActivity([{ v: 3.0 }, { v: 4.0 }]));
const trueT1 = TIMES[0], trueT2 = TIMES[1];
ok(act.pts.length > 500 && act.name === 'Treino de teste' && act.type === 'running' && act.pts[5].hr === 150, `parseGPX (${act.pts.length} pontos, hr=${act.pts[5].hr})`);
const res = C.detectSegment(act, traceFlat, { R: 25 });
console.log('comprimento ref', REFLEN.toFixed(0), 'tempos reais', trueT1.toFixed(1), trueT2.toFixed(1), 'detetado', res.map(r => r.t));
ok(res.length === 2, 'deteta as 2 passagens');
ok(res[0] && Math.abs(res[0].t - trueT1) < 4, `1.ª passagem ${res[0] && res[0].t}s vs ${trueT1.toFixed(1)}s`);
ok(res[1] && Math.abs(res[1].t - trueT2) < 4, `2.ª passagem ${res[1] && res[1].t}s vs ${trueT2.toFixed(1)}s`);
ok(res[0] && res[0].hr === 150, 'FC média');
// sentido contrário não conta
const actRev = C.parseGPX(buildActivity([{ v: 3.0, rev: true }]));
ok(C.detectSegment(actRev, traceFlat, { R: 25 }).length === 0, 'sentido contrário não é detetado');
// traçado paralelo a 70 m não conta
const farFlat = []; refXY.forEach(([x, y]) => { const [la, lo] = C.unproj(x + OFF[0] + 70, y + OFF[1] + 40); farFlat.push(la, lo); });
ok(C.detectSegment(act, farFlat, { R: 25 }).length === 0, 'traçado paralelo a ~80 m não é detetado');
// sugestão de janela num GPX de referência
const sg = { dist: REFLEN, desn: 80, tipo: 'Subida' };
const sw = C.suggestWindows(act, sg);
const sIdx = res[0].s;
const near = sw.length && sw.some(w => [res[0].s, res[1] ? res[1].s : -1].some(si => si >= 0 && Math.hypot(act.pts[w.i].x - act.pts[si].x, act.pts[w.i].y - act.pts[si].y) < 60));
ok(near, `sugestão de janela perto da passagem real (${sw.length && sw[0].len.toFixed(0)} m)`);
const tr = C.sliceToTrace(act.pts, sw[0].i, sw[0].j, 8); ok(tr.length > 40 && tr.length % 2 === 0, `trace reduzido a ${tr.length / 2} pontos`);
// pontos
const segs = [{ n: 1, tipo: 'Subida' }, { n: 2, tipo: 'Descida' }]; const ath = [{ id: 'a', g: 'M' }, { id: 'b', g: 'M' }, { id: 'c', g: 'M' }, { id: 'd', g: 'M', treinos: 6 }, { id: 'e', g: 'F' }];
const mk = (a, s, t, extra, st) => ({ a, s, h: [Object.assign({ t, st: st || 1, mod: 'c' }, extra || {})] });
const J = Date.UTC(2027, 0, 10) / 1000, F = Date.UTC(2027, 1, 10) / 1000, D = 86400;
const cf = { halfAt: 2, allAt: 3 };
// caminho 1, janeiro: a 100, b 90 (depois), c 120, d 130; e (F) 150. fevereiro: c 80
const ef = [mk('a', 1, 100, 0, J), mk('b', 1, 90, 0, J + D), mk('c', 1, 120, 0, J + 2 * D), mk('d', 1, 130, 0, J + 3 * D), mk('a', 2, 50, 0, J), mk('d', 2, 40, { fl: 'x' }, J), mk('e', 1, 150, 0, J), mk('c', 1, 80, 0, F)];
let pts = C.computePoints(ef, segs, ath, cf, 'all'); let g = Object.fromEntries(pts.map(r => [r.id, r]));
ok(g.b.pod === 8 && g.a.pod === 5 + 8 && g.c.pod === 3 + 8 && g.d.pod === 0, `pódio mensal 8/5/3 somado (a=${g.a.pod} c=${g.c.pod})`);
ok(g.e.pod === 8, 'pódio feminino separado');
ok(g.c.chk === 2 && g.a.chk === 2 && g.c.done === 1, 'check-in 1 por tentativa');
ok(g.b.stM === 1 && g.b.stA === 1 && g.b.stl === 8, `roubo do mês +3 e da época +5 acumulam (b=${g.b.stl})`);
ok(g.c.stA === 1 && g.c.stM === 0 && g.c.stl === 5, 'primeiro tempo do mês não é roubo; bater o Guardião da época +5');
ok(g.c.wins === 1 && g.b.wins === 0, 'bordão fica com o líder da época');
ok(g.a.bonus === 16 && g.d.trn === 40, 'metade +16 e Dias de Ataque limitados a 40');
ok(g.d.done === 1, 'tentativa suspeita não aprovada fica fora');
// check-in limitado a 3
const many = [1, 2, 3, 4, 5].map(i => mk('a', 1, 200 - i, 0, J + i * D)).concat([mk('a', 1, 210, 0, F), mk('a', 1, 211, 0, F + D)]); let p3 = C.computePoints(many, segs, ath, cf, 'all').find(r => r.id === 'a');
ok(p3.chk === 5 && p3.stl === 0, `check-in no máximo 3 por caminho em cada mês (3 jan + 2 fev = ${p3.chk}); bater o próprio tempo não é roubo`);
// Guardião de Todos os Tempos
const segsL = [{ n: 1, tipo: 'Subida', gtt: { M: { nome: 'X', t: 95 } } }, { n: 2, tipo: 'Descida' }];
const pl = C.computePoints([mk('a', 1, 100, 0, J), mk('b', 1, 90, 0, J + D), { a: 'b', s: 1, h: [{ t: 85, st: J + 2 * D, mod: 'c' }] }], segsL, ath, cf, 'all');
const bl = pl.find(r => r.id === 'b'); ok(bl.lendas === 1 && bl.lpts === 8 && bl.stl === 16, `+3 +5 +8 numa tentativa, lenda só uma vez (${bl.stl})`);
// mensal
const pm = Object.fromEntries(C.computePoints(ef, segs, ath, cf, 'all', '2027-02').map(r => [r.id, r]));
ok(pm.c.pod === 8 && pm.c.stl === 5 && pm.a.pod === 0 && pm.a.bonus === 0 && pm.d.trn === 0, 'ranking mensal só com o que foi ganho no mês');
ok(g.a.total === g.a.pod + g.a.chk + g.a.bonus + g.a.stl, 'total soma as parcelas');
ef[5].h[0].ap = true; const p2 = C.computePoints(ef, segs, ath, cf, 'all'); ok(p2.find(r => r.id === 'd').done === 2, 'tentativa aprovada entra');
// perfil e dificuldade calculados
const cs = (L, up, dn, gap) => C.classifySeg(L, up, dn, gap == null ? L : gap);
ok(cs(1193, 146, 5).tipo === 'Subida' && cs(1193, 146, 5).nivel === 3 && cs(1870, 379, 0).nivel === 5 && cs(282, 60, 0).nivel === 2, 'subidas: perfil e dificuldade');
ok(cs(1193, 3, 146).tipo === 'Descida' && cs(1193, 3, 146).nivel === 2 && cs(297, 0, 60).nivel === 4 && cs(723, 0, 113).nivel === 3, 'descidas: perfil e dificuldade');
ok(cs(2500, 120, 110).tipo === 'Cumeada' && cs(2500, 120, 120, 20).tipo === 'Loop', 'cumeada e loop');
const st = C.climbStats([100, 101, 100, 101, 105, 110, 108, 109, 104], 0, 8, 3); ok(st.up === 10 && st.dn === 6, `histerese na altimetria (${st.up}/${st.dn})`);
ok(C.fmtTime(75.4) === '1:15.4' && C.fmtTime(3725) === '1:02:05', 'formato de tempo');
console.log(fails ? `${fails} falha(s)` : 'todos os testes passaram'); process.exit(fails ? 1 : 0);
